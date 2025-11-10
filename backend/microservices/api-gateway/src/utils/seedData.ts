import { getDatabase } from '@ivorian-realty/shared-lib';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  try {
    const db = await getDatabase();
    const usersCollection = db.collection('users');
    const propertiesCollection = db.collection('properties');

    // Check if data already exists
    const userCount = await usersCollection.countDocuments();
    const propertyCount = await propertiesCollection.countDocuments();

    if (userCount > 0 && propertyCount > 0) {
      console.log('Database already seeded, skipping...');
      return;
    }

    console.log('Seeding database with sample data...');

    // Create sample users
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const sampleUsers = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: hashedPassword,
        role: 'buyer',
        phone: '+225123456789',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        password: hashedPassword,
        role: 'seller',
        phone: '+225987654321',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        firstName: 'Ahmed',
        lastName: 'Traore',
        email: 'ahmed.traore@example.com',
        password: hashedPassword,
        role: 'agent',
        phone: '+225555123456',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const userResult = await usersCollection.insertMany(sampleUsers);
    console.log(`Created ${userResult.insertedCount} users`);

    // Create sample properties
    const sampleProperties = [
      {
        title: 'Beautiful House in Abidjan',
        description: 'A lovely 3-bedroom house in a quiet neighborhood of Abidjan. Perfect for families with modern amenities and a beautiful garden.',
        price: 150000,
        type: 'house',
        location: {
          city: 'Abidjan',
          address: '123 Rue de la Paix, Cocody',
          coordinates: {
            lat: 5.3600,
            lng: -4.0083
          }
        },
        images: [
          'https://dummyimage.com/400x300/4F46E5/FFFFFF&text=House+1',
          'https://dummyimage.com/400x300/7C3AED/FFFFFF&text=House+2'
        ],
        bedrooms: 3,
        bathrooms: 2,
        area: 120,
        features: ['Garden', 'Parking', 'Security', 'Air Conditioning'],
        status: 'available',
        ownerId: userResult.insertedIds[1].toString(), // Jane Smith
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Modern Apartment in Plateau',
        description: 'Contemporary 2-bedroom apartment in the heart of Plateau business district. Great for professionals.',
        price: 85000,
        type: 'apartment',
        location: {
          city: 'Abidjan',
          address: '456 Avenue Franchet d\'Esperey, Plateau',
          coordinates: {
            lat: 5.3200,
            lng: -4.0200
          }
        },
        images: [
          'https://dummyimage.com/400x300/059669/FFFFFF&text=Apartment+1',
          'https://dummyimage.com/400x300/DC2626/FFFFFF&text=Apartment+2'
        ],
        bedrooms: 2,
        bathrooms: 1,
        area: 85,
        features: ['Balcony', 'Elevator', 'Security', 'Furnished'],
        status: 'available',
        ownerId: userResult.insertedIds[1].toString(), // Jane Smith
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Commercial Space in Yopougon',
        description: 'Prime commercial space perfect for retail or office use. High foot traffic area.',
        price: 200000,
        type: 'commercial',
        location: {
          city: 'Abidjan',
          address: '789 Boulevard de la Paix, Yopougon',
          coordinates: {
            lat: 5.3500,
            lng: -4.1500
          }
        },
        images: [
          'https://dummyimage.com/400x300/F59E0B/FFFFFF&text=Commercial+1',
          'https://dummyimage.com/400x300/EF4444/FFFFFF&text=Commercial+2'
        ],
        bedrooms: 0,
        bathrooms: 1,
        area: 200,
        features: ['Parking', 'Security', 'High Visibility', 'Air Conditioning'],
        status: 'available',
        ownerId: userResult.insertedIds[2].toString(), // Ahmed Traore
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Land for Sale in Bingerville',
        description: 'Large plot of land suitable for residential development. Great investment opportunity.',
        price: 75000,
        type: 'land',
        location: {
          city: 'Bingerville',
          address: 'Land Plot 123, Bingerville',
          coordinates: {
            lat: 5.4000,
            lng: -3.9000
          }
        },
        images: [
          'https://dummyimage.com/400x300/10B981/FFFFFF&text=Land+1',
          'https://dummyimage.com/400x300/8B5CF6/FFFFFF&text=Land+2'
        ],
        bedrooms: 0,
        bathrooms: 0,
        area: 500,
        features: ['Road Access', 'Electricity Nearby', 'Water Nearby'],
        status: 'available',
        ownerId: userResult.insertedIds[0].toString(), // John Doe
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const propertyResult = await propertiesCollection.insertMany(sampleProperties);
    console.log(`Created ${propertyResult.insertedCount} properties`);

    // Create indexes for better performance
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ role: 1 });
    
    await propertiesCollection.createIndex({ type: 1 });
    await propertiesCollection.createIndex({ price: 1 });
    await propertiesCollection.createIndex({ 'location.city': 1 });
    await propertiesCollection.createIndex({ status: 1 });
    await propertiesCollection.createIndex({ ownerId: 1 });
    await propertiesCollection.createIndex({ 
      title: 'text', 
      description: 'text',
      'location.city': 'text'
    });

    console.log('Database seeding completed successfully!');
    console.log('Sample users created:');
    console.log('- john.doe@example.com (buyer)');
    console.log('- jane.smith@example.com (seller)');
    console.log('- ahmed.traore@example.com (agent)');
    console.log('Password for all users: password123');

  } catch (error: any) {
    // Don't throw - just log the error
    // This allows the server to start even if seeding fails
    if (error.code === 11000) {
      console.log('Database already contains data, skipping seed...');
    } else {
      console.error('Error seeding database (non-critical):', error.message || error);
    }
  }
}
