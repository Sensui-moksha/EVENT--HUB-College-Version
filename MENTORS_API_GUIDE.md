# Mentors API — External Read-Only REST API

A secure, read-only RESTful API that exposes student event data (registrations, attendance, upcoming events, and prizes) for integration with external systems such as mentor dashboards, college portals, or reporting tools.

---

## Authentication

All endpoints require **HTTP Basic Authentication**.

Credentials are created and managed by admins in the **Users → Mentors API** tab of the EventHub admin panel.

```
Authorization: Basic <base64(username:password)>
```

> **Security notes:**
> - Passwords are bcrypt-hashed on the server — never stored in plain text.
> - Admins can enable/disable credentials at any time.
> - `lastUsedAt` timestamp is tracked for auditing.
> - This API is **read-only** — no data can be modified through it.

---

## Base URL

```
https://<your-domain>/api/external
```

---

## Endpoints

### 1. List Users

```
GET /api/external/users
```

**Query Parameters:**

| Parameter    | Type   | Default | Description                    |
|-------------|--------|---------|--------------------------------|
| `department` | string | —       | Filter by department           |
| `year`       | number | —       | Filter by year                 |
| `search`     | string | —       | Search by name, regId, or email|
| `page`       | number | 1       | Page number                    |
| `limit`      | number | 50      | Results per page (max 50)      |

**Response:**
```json
{
  "users": [
    {
      "id": "64abc...",
      "name": "John Doe",
      "email": "john@example.com",
      "regId": "21CS001",
      "department": "Computer Science",
      "year": 3,
      "section": "A",
      "college": "MIT"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 178,
    "totalPages": 4
  }
}
```

---

### 2. Get User Details (with events & prizes)

```
GET /api/external/users/:userId
```

**Response:**
```json
{
  "user": {
    "id": "64abc...",
    "name": "John Doe",
    "email": "john@example.com",
    "regId": "21CS001",
    "department": "Computer Science",
    "year": 3,
    "section": "A",
    "college": "MIT"
  },
  "stats": {
    "totalRegistered": 5,
    "totalAttended": 3,
    "totalUpcoming": 1,
    "totalPrizes": 2
  },
  "registeredEvents": [
    {
      "eventId": "...",
      "title": "Hackathon 2026",
      "date": "2026-03-15T00:00:00.000Z",
      "status": "completed",
      "category": "Technical",
      "venue": "Auditorium",
      "attendanceStatus": "attended",
      "registeredAt": "2026-03-10T..."
    }
  ],
  "attendedEvents": [
    {
      "eventId": "...",
      "title": "Hackathon 2026",
      "date": "2026-03-15T...",
      "category": "Technical",
      "venue": "Auditorium",
      "registeredAt": "2026-03-10T..."
    }
  ],
  "upcomingEvents": [
    {
      "eventId": "...",
      "title": "Tech Talk 2026",
      "date": "2026-04-01T...",
      "category": "Seminar",
      "venue": "Room 301",
      "registeredAt": "2026-03-20T..."
    }
  ],
  "prizes": [
    {
      "eventId": "...",
      "eventTitle": "Hackathon 2026",
      "eventDate": "2026-03-15T...",
      "position": 1,
      "prize": "₹10,000"
    }
  ],
  "subEventPrizes": [
    {
      "subEventId": "...",
      "subEventTitle": "Coding Round",
      "parentEventTitle": "MICFEST-26",
      "parentEventDate": "2026-02-20T...",
      "position": 2,
      "prize": "₹5,000"
    }
  ]
}
```

---

### 3. List Events

```
GET /api/external/events
```

**Query Parameters:**

| Parameter  | Type   | Default | Description                               |
|-----------|--------|---------|-------------------------------------------|
| `status`   | string | —       | Filter: `upcoming`, `completed`, `cancelled` |
| `category` | string | —       | Filter by event category                  |
| `page`     | number | 1       | Page number                               |
| `limit`    | number | 50      | Results per page                          |

**Response:**
```json
{
  "events": [
    {
      "id": "...",
      "title": "Hackathon 2026",
      "description": "Annual coding competition",
      "category": "Technical",
      "date": "2026-03-15T...",
      "time": "09:00 AM",
      "venue": "Auditorium",
      "maxParticipants": 100,
      "currentParticipants": 85,
      "status": "completed",
      "prizes": ["₹10,000", "₹5,000", "₹3,000"],
      "image": "https://..."
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 3, "totalPages": 1 }
}
```

---

### 4. Event Registrations

```
GET /api/external/events/:eventId/registrations
```

**Response:**
```json
{
  "event": { "id": "...", "title": "Hackathon 2026", "date": "...", "status": "completed" },
  "registrations": [
    {
      "userName": "John Doe",
      "userEmail": "john@example.com",
      "userRegId": "21CS001",
      "department": "Computer Science",
      "year": 3,
      "status": "attended",
      "approvalStatus": "approved",
      "registeredAt": "2026-03-10T..."
    }
  ]
}
```

---

### 5. Event Winners

```
GET /api/external/events/:eventId/winners
```

**Response:**
```json
{
  "event": { "id": "...", "title": "Hackathon 2026", "date": "..." },
  "winners": [
    {
      "position": 1,
      "prize": "₹10,000",
      "participantType": "registered",
      "participantName": "John Doe",
      "userEmail": "john@example.com",
      "userRegId": "21CS001",
      "department": "Computer Science"
    }
  ]
}
```

---

## Integration Examples

### JavaScript / Node.js

```javascript
const BASE_URL = 'https://events.mictech.dpdns.org/api/external';
const headers = {
  'Authorization': 'Basic ' + btoa('your_username:your_password')
};

// List all users in CSE department
const usersRes = await fetch(`${BASE_URL}/users?department=Computer Science`, { headers });
const { users, pagination } = await usersRes.json();

// Get specific student's full data
const userRes = await fetch(`${BASE_URL}/users/${users[0].id}`, { headers });
const userData = await userRes.json();

console.log(`${userData.user.name} attended ${userData.stats.totalAttended} events`);
console.log(`Prizes won: ${userData.stats.totalPrizes}`);
userData.prizes.forEach(p => {
  console.log(`  Position ${p.position} in ${p.eventTitle} — ${p.prize}`);
});
```

### Python

```python
import requests
from requests.auth import HTTPBasicAuth

BASE_URL = 'https://events.mictech.dpdns.org/api/external'
auth = HTTPBasicAuth('your_username', 'your_password')

# Get all 3rd-year students
response = requests.get(f'{BASE_URL}/users', params={'year': 3}, auth=auth)
data = response.json()

for user in data['users']:
    # Get each student's full event history
    detail = requests.get(f'{BASE_URL}/users/{user["id"]}', auth=auth).json()
    print(f"{detail['user']['name']}: "
          f"{detail['stats']['totalAttended']} attended, "
          f"{detail['stats']['totalPrizes']} prizes")
```

### cURL

```bash
# List users
curl -u "username:password" "https://events.mictech.dpdns.org/api/external/users"

# Get user details
curl -u "username:password" "https://events.mictech.dpdns.org/api/external/users/<userId>"

# List completed events
curl -u "username:password" "https://events.mictech.dpdns.org/api/external/events?status=completed"

# Get event winners
curl -u "username:password" "https://events.mictech.dpdns.org/api/external/events/<eventId>/winners"
```

### React / Frontend Integration

```tsx
import { useEffect, useState } from 'react';

const API_BASE = 'https://events.mictech.dpdns.org/api/external';
const AUTH = 'Basic ' + btoa('your_username:your_password');

function MentorDashboard() {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/users?department=Computer Science`, {
      headers: { Authorization: AUTH }
    })
      .then(r => r.json())
      .then(data => setStudents(data.users));
  }, []);

  return (
    <div>
      {students.map(s => (
        <div key={s.id}>
          <h3>{s.name} ({s.regId})</h3>
          <p>{s.department} — Year {s.year}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## Error Responses

| Status | Meaning                          |
|--------|----------------------------------|
| 401    | Missing or invalid credentials   |
| 403    | Credential is disabled           |
| 404    | Resource not found               |
| 500    | Server error                     |

Error body format:
```json
{ "error": "Description of the error" }
```

---

## Managing Credentials

1. Log in as **Admin** to EventHub
2. Navigate to **Users** page
3. Click the **Mentors API** tab
4. Click **New Credential** to create username/password
5. Share credentials securely with the integrating system
6. Use **Disable** to revoke access without deleting
7. Use **Update Password** to rotate credentials
8. **Delete** to permanently remove access

---

## Rate Limiting

The API inherits the application's rate limiting. For heavy usage, implement client-side caching and pagination.
