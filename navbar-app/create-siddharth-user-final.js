const fetch = require('node-fetch');

const userProfile = {
    "individual_id": "8267411571",
    "uin": "8267411571",
    "vid": "siddharth-km-123",
    "phone": "9876543210",
    "email": "siddharth.mansour@example.com",
    "status": "ACTIVATED",
    "fullName": [
        {
            "language": "eng",
            "value": "Siddharth K Mansour"
        },
        {
            "language": "fra",
            "value": "Siddharth K Mansour"
        },
        {
            "language": "ara",
            "value": "سيدهارث ك منصور"
        }
    ],
    "firstName": [
        {
            "language": "eng",
            "value": "Siddharth"
        },
        {
            "language": "fra", 
            "value": "Siddharth"
        },
        {
            "language": "ara",
            "value": "سيدهارث"
        }
    ],
    "middleName": [
        {
            "language": "eng",
            "value": "K"
        },
        {
            "language": "fra",
            "value": "K"
        },
        {
            "language": "ara",
            "value": "ك"
        }
    ],
    "lastName": [
        {
            "language": "eng",
            "value": "Mansour"
        },
        {
            "language": "fra",
            "value": "Mansour"
        },
        {
            "language": "ara",
            "value": "منصور"
        }
    ],
    "dateOfBirth": "1990/05/15",
    "gender": [
        {
            "language": "eng",
            "value": "Male"
        },
        {
            "language": "fra",
            "value": "Masculin"
        },
        {
            "language": "ara",
            "value": "ذكر"
        }
    ],
    "streetAddress": [
        {
            "language": "eng",
            "value": "123 Tech Street"
        },
        {
            "language": "fra",
            "value": "123 Rue Tech"
        },
        {
            "language": "ara",
            "value": "123 شارع التقنية"
        }
    ],
    "locality": [
        {
            "language": "eng",
            "value": "Silicon Valley"
        },
        {
            "language": "fra",
            "value": "Vallée du Silicium"
        },
        {
            "language": "ara",
            "value": "وادي السيليكون"
        }
    ],
    "region": [
        {
            "language": "eng",
            "value": "California"
        },
        {
            "language": "fra",
            "value": "Californie"
        },
        {
            "language": "ara",
            "value": "كاليفورنيا"
        }
    ],
    "postalCode": "94000",
    "country": [
        {
            "language": "eng",
            "value": "USA"
        },
        {
            "language": "fra",
            "value": "États-Unis"
        },
        {
            "language": "ara",
            "value": "الولايات المتحدة"
        }
    ],
    "encodedPhoto": "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A="
};

async function createUser() {
    try {
        console.log('Creating user in mock identity system...');
        
        const response = await fetch('http://localhost:8082/v1/mock-identity-system/identity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(userProfile)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('User created successfully:', result);
            console.log('\nUser Details:');
            console.log('UIN/Individual ID:', userProfile.individual_id);
            console.log('VID:', userProfile.vid);
            console.log('Phone:', userProfile.phone);
            console.log('Email:', userProfile.email);
            console.log('Full Name (English):', userProfile.fullName[0].value);
            console.log('Full Name (Arabic):', userProfile.fullName[2].value);
        } else {
            console.error('Failed to create user:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error details:', errorText);
        }
    } catch (error) {
        console.error('Error creating user:', error.message);
    }
}

createUser();
