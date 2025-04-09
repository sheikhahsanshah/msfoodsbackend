import Category from '../models/category.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';

// CREATE a new category (Admin only)

// CREATE a new category with images (Admin only)
export const createCategory = async (req, res) => {
    try {
        const { name, description, isActive } = req.body;

        // Process uploaded images
        const images = req.files.map((file) => ({
            public_id: file.filename,
            url: file.path,
        }));

        const category = new Category({ name, description, isActive, images });
        await category.save();

        res.status(201).json({ message: 'Category created successfully', category });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};


// READ all categories
export const getCategories = async (req, res) => {
    try {
        const categories = await Category.find({});
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// READ a single category by ID
export const getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// UPDATE a category (Admin only)
// UPDATE a category (Admin only)
export const updateCategory = async (req, res) => {
    try {
        const { name, description, isActive, keepExistingImages } = req.body;
        const category = await Category.findById(req.params.id);

        if (!category) return res.status(404).json({ error: 'Category not found' });

        // Only process images if new ones are uploaded
        if (req.files && req.files.length > 0) {
            // Delete old images from Cloudinary
            for (let img of category.images) {
                await deleteFromCloudinary(img.public_id);
            }

            // Set new images
            category.images = req.files.map((file) => ({
                public_id: file.filename,
                url: file.path,
            }));
        }
        // If keepExistingImages is not true and no new images, we could clear images
        // But in this case we'll keep them unless new ones are provided

        category.name = name || category.name;
        category.description = description || category.description;
        category.isActive = isActive !== undefined ? isActive === 'true' : category.isActive;

        await category.save();
        res.json({ message: 'Category updated successfully', category });
    } catch (error) {
        console.error('Update category error:', error);
        res.status(400).json({ error: error.message });
    }
};

// DELETE a category (Admin only)
export const deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });

        // Delete images from Cloudinary
        for (let img of category.images) {
            await deleteFromCloudinary(img.public_id);
        }

        await Category.findByIdAndDelete(req.params.id);
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

