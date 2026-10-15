const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ตั้งค่าเชื่อมต่อ Database
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10
});

// ตรวจสอบการเชื่อมต่อ
pool.getConnection()
    .then(conn => {
        console.log("Database connected successfully!");
        conn.release();
    })
    .catch(err => console.error("Database connection failed:", err.message));

// ==========================================
// Phase 1: Authentication & Employee Management
// ==========================================

// [POST] /api/login
app.post('/api/login', (req, res) => {
    // แก้ไขตาม A3.2: ป้องกัน req.body undefined
    const { username, password } = req.body || {};
    if (username === 'admin' && password === 'password123') {
        res.status(200).json({ success: true, token: "mock-jwt-token" });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});

// [GET] /api/employees - ดึงข้อมูลพนักงานทั้งหมด
app.get('/api/employees', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM employees ORDER BY id');
        // แก้ไขตาม A3.6: แปลง salary จาก string(DECIMAL) ให้เป็น Number
        const formattedRows = rows.map(r => ({ ...r, salary: Number(r.salary) }));
        res.status(200).json(formattedRows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// [POST] /api/employees - เพิ่มพนักงานใหม่
app.post('/api/employees', async (req, res) => {
    const { name, position, salary } = req.body || {};

    // แก้ไขตาม A3.3: ตรวจสอบ Validation เข้มงวดขึ้น
    if (typeof name !== 'string' || name.trim() === '' || 
        typeof position !== 'string' || position.trim() === '') {
        return res.status(400).json({ success: false, message: "Name and position must be non-empty strings" });
    }

    const numSalary = Number(salary);
    if (!Number.isFinite(numSalary) || numSalary <= 0) {
        return res.status(400).json({ success: false, message: "Salary must be a positive number" });
    }

    try {
        const trimmedName = name.trim();
        const trimmedPosition = position.trim();

        const [result] = await pool.query(
            "INSERT INTO employees (name, position, status, salary) VALUES (?, ?, 'Active', ?)", 
            [trimmedName, trimmedPosition, numSalary]
        );
        res.status(201).json({ 
            success: true, 
            employee: { id: result.insertId, name: trimmedName, position: trimmedPosition, status: 'Active', salary: numSalary } 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// [PUT] /api/employees/:id/status - สลับสถานะพนักงาน (Active <-> On Leave)
app.put('/api/employees/:id/status', async (req, res) => {
    const employeeId = Number(req.params.id);
    
    // ตรวจสอบว่าเป็น positive integer
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    try {
        const [rows] = await pool.query('SELECT status FROM employees WHERE id = ?', [employeeId]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }

        const currentStatus = rows[0].status;
        const newStatus = currentStatus === 'Active' ? 'On Leave' : 'Active';

        await pool.query('UPDATE employees SET status = ? WHERE id = ?', [newStatus, employeeId]);
        res.status(200).json({ success: true, newStatus: newStatus });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// [DELETE] /api/employees/:id - ลบพนักงาน
app.delete('/api/employees/:id', async (req, res) => {
    const employeeId = Number(req.params.id);
    
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    try {
        const [result] = await pool.query('DELETE FROM employees WHERE id = ?', [employeeId]);
        // แก้ไขตาม A3.5: คืนค่า 404 ถ้าไม่มีแถวถูกลบ
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }
        res.status(200).json({ success: true, message: "Employee deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ==========================================
// Phase 2: Automated Salary Clustering (K-Means)
// ==========================================
// ดึงฟังก์ชันมาจากไฟล์ kmeans.js
const { kMeans1D } = require('./kmeans');

// [GET] /api/employees/salary-clusters
app.get('/api/employees/salary-clusters', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT salary FROM employees');
        const salaries = rows.map(r => Number(r.salary));

        // คืนค่าอาร์เรย์ว่างถ้าไม่มีข้อมูล
        if (salaries.length === 0) {
            return res.status(200).json({ success: true, clusters: [] });
        }

        // ประมวลผล K-Means โดยเรียกใช้ฟังก์ชันภายนอก
        const resultClusters = kMeans1D(salaries, 3, 100);

        // ใส่ชื่อกลุ่ม (Tier 1..k)
        const formattedClusters = resultClusters.map((c, i) => ({
            group: `Tier ${i + 1}`,
            centroid: c.centroid,
            count: c.count
        }));

        res.status(200).json({ success: true, clusters: formattedClusters });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ==========================================
// Error Handling Middleware
// ==========================================

// Catch-all 404
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Not Found" });
});

// Basic error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: "Internal server error" });
});

const PORT = process.env.PORT || 3062;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});