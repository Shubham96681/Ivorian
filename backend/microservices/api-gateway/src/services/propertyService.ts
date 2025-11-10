import { ObjectId } from 'mongodb';
import { getDatabase } from '@ivorian-realty/shared-lib';
import { AppError } from '../middleware/errorHandler';

export interface Property {
  _id?: string;
  title: string;
  description: string;
  price: number;
  type: 'house' | 'apartment' | 'land' | 'commercial';
  location: {
    city: string;
    address: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  images: string[];
  bedrooms?: number;
  bathrooms?: number;
  area: number;
  features?: string[];
  status: 'available' | 'sold' | 'rented' | 'pending';
  ownerId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PropertySearchFilters {
  search?: string;
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  bedrooms?: number;
  bathrooms?: number;
  status?: string;
  page?: number;
  limit?: number;
}

export interface PropertyResponse {
  success: boolean;
  message: string;
  data: Property | Property[] | { properties: Property[]; total: number; page: number; limit: number };
}

export class PropertyService {
  private async getPropertiesCollection() {
    const db = await getDatabase();
    return db.collection('properties');
  }

  async getAllProperties(filters: PropertySearchFilters = {}): Promise<PropertyResponse> {
    try {
      const properties = await this.getPropertiesCollection();
      const {
        search,
        type,
        minPrice,
        maxPrice,
        city,
        bedrooms,
        bathrooms,
        status = 'available',
        page = 1,
        limit = 10
      } = filters;

      // Build query
      const query: any = { status };

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { 'location.city': { $regex: search, $options: 'i' } }
        ];
      }

      if (type) {
        query.type = type;
      }

      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = minPrice;
        if (maxPrice) query.price.$lte = maxPrice;
      }

      if (city) {
        query['location.city'] = { $regex: city, $options: 'i' };
      }

      if (bedrooms) {
        query.bedrooms = { $gte: bedrooms };
      }

      if (bathrooms) {
        query.bathrooms = { $gte: bathrooms };
      }

      // Calculate pagination
      const skip = (page - 1) * limit;
      const total = await properties.countDocuments(query);

      // Execute query with pagination
      const propertiesList = await properties
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const typedProperties: Property[] = propertiesList.map((p: any) => ({
        _id: p._id.toString(),
        title: p.title,
        description: p.description,
        price: p.price,
        type: p.type,
        location: p.location,
        images: p.images || [],
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area: p.area,
        features: p.features,
        status: p.status,
        ownerId: p.ownerId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }));

      return {
        success: true,
        message: 'Properties retrieved successfully',
        data: {
          properties: typedProperties,
          total,
          page,
          limit
        }
      };
    } catch (error) {
      throw new AppError('Failed to retrieve properties', 500);
    }
  }

  async getPropertyById(id: string): Promise<PropertyResponse> {
    try {
      const properties = await this.getPropertiesCollection();
      const property = await properties.findOne({ _id: new ObjectId(id) });
      if (!property) {
        throw new AppError('Property not found', 404);
      }

      const typedProperty: Property = {
        _id: property._id.toString(),
        title: property.title as string,
        description: property.description as string,
        price: property.price as number,
        type: property.type as Property['type'],
        location: property.location as Property['location'],
        images: (property.images || []) as string[],
        bedrooms: property.bedrooms as number | undefined,
        bathrooms: property.bathrooms as number | undefined,
        area: property.area as number,
        features: property.features as string[] | undefined,
        status: property.status as Property['status'],
        ownerId: property.ownerId as string,
        createdAt: property.createdAt as Date | undefined,
        updatedAt: property.updatedAt as Date | undefined
      };

      return {
        success: true,
        message: 'Property retrieved successfully',
        data: typedProperty
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve property', 500);
    }
  }

  async createProperty(propertyData: Omit<Property, '_id' | 'createdAt' | 'updatedAt'>): Promise<PropertyResponse> {
    try {
      const properties = await this.getPropertiesCollection();
      const newProperty: Property = {
        ...propertyData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await properties.insertOne(newProperty as any);
      const propertyId = result.insertedId.toString();

      const createdProperty = await properties.findOne({ _id: result.insertedId });
      if (!createdProperty) {
        throw new AppError('Failed to create property', 500);
      }

      const typedProperty: Property = {
        _id: createdProperty._id.toString(),
        title: createdProperty.title as string,
        description: createdProperty.description as string,
        price: createdProperty.price as number,
        type: createdProperty.type as Property['type'],
        location: createdProperty.location as Property['location'],
        images: (createdProperty.images || []) as string[],
        bedrooms: createdProperty.bedrooms as number | undefined,
        bathrooms: createdProperty.bathrooms as number | undefined,
        area: createdProperty.area as number,
        features: createdProperty.features as string[] | undefined,
        status: createdProperty.status as Property['status'],
        ownerId: createdProperty.ownerId as string,
        createdAt: createdProperty.createdAt as Date | undefined,
        updatedAt: createdProperty.updatedAt as Date | undefined
      };

      return {
        success: true,
        message: 'Property created successfully',
        data: typedProperty
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create property', 500);
    }
  }

  async updateProperty(id: string, updateData: Partial<Omit<Property, '_id' | 'createdAt' | 'ownerId'>>): Promise<PropertyResponse> {
    try {
      const properties = await this.getPropertiesCollection();
      const updateFields = {
        ...updateData,
        updatedAt: new Date()
      };

      const result = await properties.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
      );

      if (result.matchedCount === 0) {
        throw new AppError('Property not found', 404);
      }

      const updatedProperty = await properties.findOne({ _id: new ObjectId(id) });
      if (!updatedProperty) {
        throw new AppError('Property not found', 404);
      }

      const typedProperty: Property = {
        _id: updatedProperty._id.toString(),
        title: updatedProperty.title as string,
        description: updatedProperty.description as string,
        price: updatedProperty.price as number,
        type: updatedProperty.type as Property['type'],
        location: updatedProperty.location as Property['location'],
        images: (updatedProperty.images || []) as string[],
        bedrooms: updatedProperty.bedrooms as number | undefined,
        bathrooms: updatedProperty.bathrooms as number | undefined,
        area: updatedProperty.area as number,
        features: updatedProperty.features as string[] | undefined,
        status: updatedProperty.status as Property['status'],
        ownerId: updatedProperty.ownerId as string,
        createdAt: updatedProperty.createdAt as Date | undefined,
        updatedAt: updatedProperty.updatedAt as Date | undefined
      };

      return {
        success: true,
        message: 'Property updated successfully',
        data: typedProperty
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update property', 500);
    }
  }

  async deleteProperty(id: string): Promise<PropertyResponse> {
    try {
      const properties = await this.getPropertiesCollection();
      const result = await properties.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) {
        throw new AppError('Property not found', 404);
      }

      return {
        success: true,
        message: 'Property deleted successfully',
        data: { _id: id } as Property
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete property', 500);
    }
  }

  async getPropertiesByOwner(ownerId: string): Promise<PropertyResponse> {
    try {
      const properties = await this.getPropertiesCollection();
      const propertiesList = await properties
        .find({ ownerId })
        .sort({ createdAt: -1 })
        .toArray();

      const typedProperties: Property[] = propertiesList.map((p: any) => ({
        _id: p._id.toString(),
        title: p.title,
        description: p.description,
        price: p.price,
        type: p.type,
        location: p.location,
        images: p.images || [],
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area: p.area,
        features: p.features,
        status: p.status,
        ownerId: p.ownerId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }));

      return {
        success: true,
        message: 'Properties retrieved successfully',
        data: typedProperties
      };
    } catch (error) {
      throw new AppError('Failed to retrieve properties', 500);
    }
  }
}
