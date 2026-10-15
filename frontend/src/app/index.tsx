import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert, TouchableOpacity } from 'react-native';

const BASE_URL = 'http://119.59.102.161:3062/api';

// กำหนดโครงสร้าง Type ให้กับข้อมูล Employee เพื่อแก้ Error "does not exist on type 'never'"
interface Employee {
  id: number;
  name: string;
  position: string;
  status: string;
  salary: number;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (!isLoggedIn) {
    return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;
  }
  return <DashboardScreen />;
}

// ==========================================
// 1. Login Screen
// ==========================================
// ระบุ Type ให้ Props onLogin
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const response = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        onLogin();
      } else {
        Alert.alert('Login Failed', 'Invalid username or password');
      }
    } catch (error) {
      Alert.alert('Error', 'Cannot connect to server');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>HR System Login</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Login" onPress={handleLogin} />
    </View>
  );
}

// ==========================================
// 2. Dashboard Screen (CRUD UI)
// ==========================================
function DashboardScreen() {
  // ผูก Type Employee[] เข้ากับ State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${BASE_URL}/employees`);
      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddEmployee = async () => {
    if (!name || !position || !salary) {
      Alert.alert('Validation Error', 'All fields are required!');
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, position, salary: Number(salary) }),
      });
      if (response.ok) {
        setName('');
        setPosition('');
        setSalary('');
        fetchEmployees(); 
      }
    } catch (error) {
      console.error(error);
    }
  };

  // ระบุ Type ให้ id เป็น number
  const handleToggleStatus = async (id: number) => {
    try {
      const response = await fetch(`${BASE_URL}/employees/${id}/status`, {
        method: 'PUT',
      });
      if (response.ok) {
        fetchEmployees();
      }
    } catch (error) {
      console.error(error);
    }
  };

  // ระบุ Type ให้ id เป็น number
  const handleDelete = (id: number) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this employee?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BASE_URL}/employees/${id}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                fetchEmployees();
              }
            } catch (error) {
              console.error(error);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>HR Dashboard</Text>
      
      <View style={styles.form}>
        <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Position" value={position} onChangeText={setPosition} />
        <TextInput style={styles.input} placeholder="Salary" value={salary} onChangeText={setSalary} keyboardType="numeric" />
        <Button title="Add Employee" onPress={handleAddEmployee} />
      </View>

      <FlatList
        data={employees}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text>{item.position} | Salary: {item.salary}</Text>
            <Text>Status: {item.status}</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.btnAction} onPress={() => handleToggleStatus(item.id)}>
                <Text style={styles.btnText}>Toggle Status</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnAction, styles.btnDelete]} onPress={() => handleDelete(item.id)}>
                <Text style={styles.btnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#f5f5f5' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  form: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 4 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btnAction: { backgroundColor: '#007BFF', padding: 10, borderRadius: 4, flex: 0.48, alignItems: 'center' },
  btnDelete: { backgroundColor: '#DC3545' },
  btnText: { color: '#fff', fontWeight: 'bold' }
});