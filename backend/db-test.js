
require('dotenv').config();

const mysql = require('mysql2/promise');

async function testDatabase() {
    let connection;

    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT || 3306),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('Connected to MySQL successfully!');

        const [rows] = await connection.query(
            'SELECT DATABASE() AS db_name'
        );

        console.log('Database:', rows[0].db_name);

        const [employees] = await connection.query(
            'SELECT COUNT(*) AS total FROM employees'
        );

        console.log('Employees:', employees[0].total);

    } catch (error) {
        console.error('Database connection failed:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

testDatabase();