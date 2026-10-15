import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { showAlert, confirmDialog } from './utils/dialog';
import { API_URL } from './config';

interface Employee {
  id: number;
  name: string;
  position: string;
  status: string;
  salary: number;
}

interface Cluster {
  group: string;
  centroid: number;
  count: number;
}

export default function DashboardScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${API_URL}/employees`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setEmployees(data);
        }
      } else {
         showAlert('Error', 'Failed to fetch employees');
      }
    } catch (error) {
      showAlert('Network Error', 'Cannot connect to server');
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddEmployee = async () => {
    const trimmedName = name.trim();
    const trimmedPosition = position.trim();
    const numSalary = Number(salary);

    if (!trimmedName || !trimmedPosition) {
      showAlert('Validation Error', 'Name and Position are required!');
      return;
    }
    if (Number.isNaN(numSalary) || numSalary <= 0) {
        showAlert('Validation Error', 'Salary must be a valid positive number!');
        return;
    }

    try {
      const response = await fetch(`${API_URL}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, position: trimmedPosition, salary: numSalary }),
      });
      const data = await response.json();
      if (response.ok) {
        setName(''); setPosition(''); setSalary('');
        fetchEmployees(); 
        setClusters(null); // Clear stale clusters
      } else {
         showAlert('Error', data.message || 'Failed to add employee');
      }
    } catch (error) {
      showAlert('Network Error', 'Cannot connect to server');
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/employees/${id}/status`, { method: 'PUT' });
      if (response.ok) {
          fetchEmployees();
      } else {
          const data = await response.json();
          showAlert('Error', data.message || 'Failed to update status');
      }
    } catch (error) {
       showAlert('Network Error', 'Cannot connect to server');
    }
  };

  const handleDelete = (id: number) => {
    confirmDialog('Confirm Delete', 'Are you sure?', async () => {
      try {
        const response = await fetch(`${API_URL}/employees/${id}`, { method: 'DELETE' });
        if (response.ok) {
            fetchEmployees();
            setClusters(null); // Clear stale clusters
        } else {
            const data = await response.json();
            showAlert('Error', data.message || 'Failed to delete employee');
        }
      } catch (error) {
         showAlert('Network Error', 'Cannot connect to server');
      }
    });
  };

  const handleAnalyzeSalary = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch(`${API_URL}/employees/salary-clusters`);
      const data = await response.json();
      if (response.ok && data.success) {
        setClusters(data.clusters);
      } else {
        showAlert('Analysis Failed', data.message || 'Error occurred');
      }
    } catch (error) {
      showAlert('Network Error', 'Cannot connect to server');
    } finally {
      setAnalyzing(false);
    }
  };

  const renderHeader = () => (
      <>
        <Text style={styles.header}>HR Dashboard</Text>

        <View style={styles.analyticsBox}>
            <Button 
                title={analyzing ? "Analyzing..." : "Analyze Salary Structure"} 
                onPress={handleAnalyzeSalary} 
                color="#28A745" 
                disabled={analyzing}
            />

            {analyzing && <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 10 }} />}

            {clusters !== null && (
            <View style={styles.clusterResult}>
                {clusters.length === 0 ? (
                    <Text style={{fontWeight: 'bold'}}>No employee data to analyze</Text>
                ) : (
                    <>
                    <Text style={{fontWeight: 'bold', marginBottom: 5}}>K-Means Clustering Results:</Text>
                    {clusters.map((c, index) => (
                    <View key={index} style={[styles.tierCard, { borderLeftColor: index === 0 ? '#DC3545' : index === 1 ? '#FFC107' : '#28A745' }]}>
                        <Text style={styles.tierName}>{c.group}</Text>
                        <Text>Count: {c.count}</Text>
                        <Text>Avg Salary: {c.centroid.toLocaleString()} THB</Text>
                    </View>
                    ))}
                    </>
                )}
            </View>
            )}
        </View>

        <View style={styles.form}>
            <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Position" value={position} onChangeText={setPosition} />
            <TextInput style={styles.input} placeholder="Salary" value={salary} onChangeText={setSalary} keyboardType="numeric" />
            <Button title="Add Employee" onPress={handleAddEmployee} />
        </View>
      </>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <FlatList
        data={employees}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        refreshing={refreshing}
        onRefresh={fetchEmployees}
        ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20}}>No employees found.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text>{item.position} | Salary: {Number(item.salary).toLocaleString()} THB</Text>
            <View style={[styles.badge, item.status === 'Active' ? styles.badgeActive : styles.badgeLeave]}>
                <Text style={styles.badgeText}>{item.status}</Text>
            </View>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, paddingTop: 40, backgroundColor: '#f5f5f5' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  analyticsBox: { backgroundColor: '#E8F5E9', padding: 15, borderRadius: 8, marginBottom: 15 },
  clusterResult: { marginTop: 10 },
  tierCard: { backgroundColor: '#fff', padding: 10, marginVertical: 5, borderRadius: 4, borderLeftWidth: 5 },
  tierName: { fontWeight: 'bold', fontSize: 16 },
  form: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 4 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginVertical: 5 },
  badgeActive: { backgroundColor: '#28A745' },
  badgeLeave: { backgroundColor: '#FFC107' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btnAction: { backgroundColor: '#007BFF', padding: 10, borderRadius: 4, flex: 0.48, alignItems: 'center' },
  btnDelete: { backgroundColor: '#DC3545' },
  btnText: { color: '#fff', fontWeight: 'bold' }
});