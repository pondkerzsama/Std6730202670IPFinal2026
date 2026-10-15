// backend/kmeans.js

function kMeans1D(values, k = 3, maxIter = 100) {
    if (values.length === 0) return [];

    // หาค่าที่ไม่ซ้ำกันเพื่อใช้ตั้งต้น
    const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
    let effectiveK = Math.min(k, uniqueValues.length);

    let centroids = [];
    if (effectiveK === 1) {
        centroids = [uniqueValues[0]];
    } else if (effectiveK === 2) {
        centroids = [uniqueValues[0], uniqueValues[uniqueValues.length - 1]];
    } else {
        centroids = [
            uniqueValues[0], 
            uniqueValues[Math.floor(uniqueValues.length / 2)], 
            uniqueValues[uniqueValues.length - 1]
        ];
    }

    let clusters = [];
    let isChanged = true;
    let iter = 0;
    let prevAssignments = new Array(values.length).fill(-1);

    while (isChanged && iter < maxIter) {
        iter++;
        clusters = Array.from({ length: effectiveK }, () => []);
        let currentAssignments = [];
        isChanged = false;

        // ขั้นตอนที่ 1: จัดกลุ่ม (Assignment)
        for (let i = 0; i < values.length; i++) {
            let s = values[i];
            let minDiff = Infinity;
            let clusterIndex = 0;
            
            for (let j = 0; j < effectiveK; j++) {
                let diff = Math.abs(s - centroids[j]);
                if (diff < minDiff) {
                    minDiff = diff;
                    clusterIndex = j;
                }
            }
            clusters[clusterIndex].push(s);
            currentAssignments.push(clusterIndex);

            if (currentAssignments[i] !== prevAssignments[i]) {
                isChanged = true;
            }
        }
        prevAssignments = currentAssignments;

        // ขั้นตอนที่ 2: หาจุดศูนย์กลางใหม่ (Update Centroids)
        for (let j = 0; j < effectiveK; j++) {
            if (clusters[j].length > 0) {
                let sum = clusters[j].reduce((a, b) => a + b, 0);
                centroids[j] = sum / clusters[j].length;
            } else {
                // จัดการกรณีกลุ่มว่างเปล่า (re-seed)
                let farthestPoint = values[0];
                let maxDist = -1;
                for (let v of values) {
                    let minToAnyCentroid = Math.min(...centroids.map(c => Math.abs(v - c)));
                    if (minToAnyCentroid > maxDist) {
                        maxDist = minToAnyCentroid;
                        farthestPoint = v;
                    }
                }
                centroids[j] = farthestPoint;
                isChanged = true;
            }
        }
    }

    // สร้างข้อมูลผลลัพธ์และเรียงตาม Centroid
    const result = centroids.map((c, i) => ({
        centroid: Math.round(c),
        count: clusters[i].length
    })).filter(c => c.count > 0).sort((a, b) => a.centroid - b.centroid);

    return result;
}

module.exports = { kMeans1D };