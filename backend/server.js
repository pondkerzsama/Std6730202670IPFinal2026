const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ตั้งค่าเชื่อมต่อ Database (ดึงจาก .env)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
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
    const { username, password } = req.body;
    if (username === 'admin' && password === 'password123') {
        res.status(200).json({ success: true, token: "mock-jwt-token" });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});

// [GET] /api/employees - ดึงข้อมูลพนักงานทั้งหมด
app.get('/api/employees', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM employees');
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [POST] /api/employees - เพิ่มพนักงานใหม่
app.post('/api/employees', async (req, res) => {
    const { name, position, salary } = req.body;

    // ตรวจสอบข้อมูลว่างเปล่า (400 Bad Request)
    if (!name || !position || !salary) {
        return res.status(400).json({ success: false, message: "Name, position, and salary are required" });
    }

    try {
        // ค่า status จะเป็น 'Active' อัตโนมัติตาม Default ของ Database
        const [result] = await pool.query(
            'INSERT INTO employees (name, position, salary) VALUES (?, ?, ?)', 
            [name, position, salary]
        );
        res.status(200).json({ success: true, insertId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [PUT] /api/employees/:id/status - สลับสถานะพนักงาน (Active <-> On Leave)
app.put('/api/employees/:id/status', async (req, res) => {
    const employeeId = req.params.id;
    try {
        // ดึงสถานะปัจจุบันมาเช็คก่อน
        const [rows] = await pool.query('SELECT status FROM employees WHERE id = ?', [employeeId]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }

        // สลับสถานะ
        const currentStatus = rows[0].status;
        const newStatus = currentStatus === 'Active' ? 'On Leave' : 'Active';

        await pool.query('UPDATE employees SET status = ? WHERE id = ?', [newStatus, employeeId]);
        res.status(200).json({ success: true, newStatus: newStatus });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [DELETE] /api/employees/:id - ลบพนักงาน
app.delete('/api/employees/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM employees WHERE id = ?', [req.params.id]);
        res.status(200).json({ success: true, message: "Employee deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// Phase 2: Automated Salary Clustering (K-Means)
// ==========================================

// [GET] /api/employees/salary-clusters
app.get('/api/employees/salary-clusters', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT salary FROM employees');
        const salaries = rows.map(r => parseFloat(r.salary));

        // K-Means ต้องการข้อมูลอย่างน้อยเท่ากับจำนวนกลุ่ม (k=3)
        if (salaries.length < 3) {
            return res.status(400).json({ success: false, message: "Need at least 3 employees to group into 3 tiers" });
        }

        // 1D K-Means Clustering Algorithm (k=3)
        salaries.sort((a, b) => a - b);
        let centroids = [
            salaries[0], // ค่าต่ำสุด
            salaries[Math.floor(salaries.length / 2)], // ค่ากลาง
            salaries[salaries.length - 1] // ค่าสูงสุด
        ];

        let clusters = [[], [], []];
        let isChanged = true;
        let maxIter = 100;

        while (isChanged && maxIter > 0) {
            clusters = [[], [], []];
            isChanged = false;
            maxIter--;

            // จัดกลุ่มเงินเดือนเข้าหา Centroid ที่ใกล้ที่สุด
            for (let s of salaries) {
                let minDiff = Infinity;
                let clusterIndex = 0;
                for (let i = 0; i < 3; i++) {
                    let diff = Math.abs(s - centroids[i]);
                    if (diff < minDiff) {
                        minDiff = diff;
                        clusterIndex = i;
                    }
                }
                clusters[clusterIndex].push(s);
            }

            // คำนวณหาจุดศูนย์กลาง (Centroid) ใหม่ของแต่ละกลุ่ม
            for (let i = 0; i < 3; i++) {
                if (clusters[i].length > 0) {
                    let sum = clusters[i].reduce((a, b) => a + b, 0);
                    let newCentroid = sum / clusters[i].length;
                    if (newCentroid !== centroids[i]) {
                        centroids[i] = newCentroid;
                        isChanged = true;
                    }
                }
            }
        }

        // เตรียมข้อมูลส่งกลับ จัดเรียงจากน้อยไปมาก
        const resultClusters = centroids.map((c, i) => ({
            centroid: Math.round(c),
            count: clusters[i].length
        })).sort((a, b) => a.centroid - b.centroid);

        // ใส่ชื่อกลุ่ม (Tier 1-3)
        const formattedClusters = resultClusters.map((c, i) => ({
            group: `Tier ${i + 1}`,
            centroid: c.centroid,
            count: c.count
        }));

        res.status(200).json({ success: true, clusters: formattedClusters });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3062;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});