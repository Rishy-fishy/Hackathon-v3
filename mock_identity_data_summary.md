# Mock Identity System Data Summary

## 📊 Data Upload Summary for Hackathon-v3

**Date**: September 24, 2025  
**Project**: hackathon-v3-docker  
**VM Instance**: hackathon-v3-vm (34.58.198.143)

## 📈 Database Statistics

### Mock Identity Records
- **Total Identity Records**: **5 users**
- **Database**: `mosip_mockidentitysystem`
- **Table**: `mock_identity`

### Individual IDs Uploaded:
1. **1234567890** - Siddharth K Manso
2. **7003476853** - Harsh bontala  
3. **8777782136** - Rishav Kumar
4. **9069197741** - Ayan Panda
5. **9392351645** - Aritraditya Roy

### Additional Data Tables:
- **KYC Authentication Records**: 45 entries (authentication history)
- **Verified Claims**: 0 entries
- **Key Store Entries**: Available (for cryptographic operations)
- **Key Policies**: Configured

## 🗂️ Data Structure

Each identity record contains:
- **Individual ID**: Unique 10-digit identifier
- **PIN**: Authentication PIN (545411 for all test users)
- **Full Name**: Multi-language support (English/French)
- **Phone Number**: Contact information
- **Email**: Contact information  
- **Address**: Location details
- **Date of Birth**: Personal information

## 🔍 Usage Analytics

### Authentication History:
- **Total Authentication Attempts**: 45 records in kyc_auth table
- **Active Period**: Last 12 days (since containers started)
- **Authentication Success Rate**: Available in kyc_auth logs

### System Status:
- ✅ Mock Identity System: Running (Port 8082)
- ✅ PostgreSQL Database: Running (Port 5455)
- ✅ eSignet Backend: Running (Port 8088)
- ✅ eSignet UI: Running (Port 3000)
- ✅ Redis Cache: Running (Port 6379)

## 🚀 Data Upload Commands Used

The mock identity data was likely uploaded using:
1. **Direct SQL Inserts**: Into PostgreSQL database
2. **API Endpoints**: Mock Identity System REST APIs
3. **Bulk Import Scripts**: Custom data loading scripts

## 💾 Storage Details

- **Database Size**: Lightweight (5 identity records)
- **Storage Location**: Google Cloud VM persistent disk
- **Backup Status**: Included in VM snapshots
- **Data Format**: JSON identity objects stored in VARCHAR fields

## 📋 Next Steps for Data Management

1. **Expand Dataset**: Add more test users if needed
2. **Backup Strategy**: Regular database dumps
3. **Monitoring**: Track authentication patterns
4. **Cleanup**: Remove test data before production

---

**Generated using gcloud commands on**: September 24, 2025  
**VM Uptime**: 12 days  
**System Health**: All services operational ✅