# PostgreSQL Database Inspection Commands

## Step 1: Check Running Docker Containers
```bash
docker ps
```
Look for PostgreSQL container (usually named postgres, db, or similar)

## Step 2: Connect to PostgreSQL Container
```bash
# Replace 'container_name' with actual PostgreSQL container name
docker exec -it container_name psql -U postgres

# Or if using different user/database
docker exec -it container_name psql -U your_username -d your_database
```

## Step 3: List All Databases
```sql
\l
```

## Step 4: Connect to Your Database
```sql
\c your_database_name
```

## Step 5: List All Tables
```sql
\dt
```

## Step 6: Check User/Identity Tables Structure
```sql
-- Check table structure for users/identities
\d users
\d identities
\d agents

-- Or describe any table that might contain user data
\d table_name
```

## Step 7: Check Sample Data
```sql
-- Look at a few rows to see the data structure
SELECT * FROM users LIMIT 5;
SELECT * FROM identities LIMIT 5;
SELECT * FROM agents LIMIT 5;

-- Check specifically for individual ID fields
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('users', 'identities', 'agents')
AND column_name LIKE '%id%';
```

## Step 8: Find Individual IDs
```sql
-- Check what individual ID values look like
SELECT individual_id, name, email, phone FROM users WHERE individual_id IS NOT NULL LIMIT 10;
SELECT individual_id, name, email, phone FROM identities WHERE individual_id IS NOT NULL LIMIT 10;
```

---

## Quick One-Liner Commands

If you want to run these quickly, here are some one-liners:

```bash
# Check tables and data in one go
docker exec -it CONTAINER_NAME psql -U postgres -d DATABASE_NAME -c "\dt; SELECT * FROM users LIMIT 3; SELECT * FROM identities LIMIT 3;"

# Check individual ID columns specifically  
docker exec -it CONTAINER_NAME psql -U postgres -d DATABASE_NAME -c "SELECT column_name, table_name FROM information_schema.columns WHERE column_name LIKE '%individual%' OR column_name LIKE '%id%';"
```

Replace:
- `CONTAINER_NAME` with your PostgreSQL container name
- `DATABASE_NAME` with your database name  
- `postgres` with your PostgreSQL username if different