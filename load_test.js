import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Load Testing Options
// Simulates a ramp-up to 500 Virtual Users (VUs) and peak surge to 2,000 VUs
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp-up to 50 users
    { duration: '1m',  target: 500 },  // Steady load 500 users
    { duration: '30s', target: 2000 }, // Peak traffic surge (Simulating Adzan push notification open)
    { duration: '1m',  target: 500 },  // Scale down
    { duration: '30s', target: 0 },    // Ramp-down to 0
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
    http_req_duration: ['p(95)<500'], // 95% of requests should complete within 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api/v1';

export default function () {
  // 1. Health Check Test
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status 200': (r) => r.status === 200,
  });

  // 2. Fetch Prayer Times (High Concurrency Endpoint)
  const prayerRes = http.get(`${BASE_URL}/prayer/schedule?city=Jakarta&country=Indonesia`);
  check(prayerRes, {
    'prayer schedule status 200': (r) => r.status === 200,
    'prayer response time < 300ms': (r) => r.timings.duration < 300,
  });

  // 3. Fetch Posts Feed
  const feedRes = http.get(`${BASE_URL}/posts?page=1&limit=10`);
  check(feedRes, {
    'feed status 200': (r) => r.status === 200,
  });

  // 4. Search Nearby Mosques (Geospatial Endpoint)
  const mosqueRes = http.get(`${BASE_URL}/masjid/nearby?lat=-6.2088&lng=106.8456&radius=5000`);
  check(mosqueRes, {
    'nearby mosques status 200': (r) => r.status === 200,
  });

  sleep(1); // Simulate user think time between actions
}
