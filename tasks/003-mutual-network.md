# Task 003: Multi-Hop Recommendation Engine

## Description

Implement the API endpoint
 and UI widget for multi-hop graph traversals.

## Requirements

1. **API Route**: `GET /api/recommendations?talentId=...&skill=...`
2. **Query Processing**: Execute parameterized 3-hop traversal searching for mutual collaborators and indirect agency connections.
3. **UI Component**: Render recommended talent cards along with a visual path explaining *how* they are connected (e.g., *"Connected via Agency X on Project Y"*).
