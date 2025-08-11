import Product from '../models/Product.js';
import { handleResponse, handleError } from '../utils/responseHandler.js';
import APIFeatures from '../utils/apiFeatures.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getAllProducts = async (req, res) => {
    try {
        const features = new APIFeatures(Product.find(), req.query)
            .filter()
            .sort()
            .limitFields()
            .paginate();

        const products = await features.query.lean(); // Use lean() for better performance
        const total = await Product.countDocuments(features.filterQuery);

        // Safely process products with calculated sale prices
        const processedProducts = products.map(product => {
            try {
                // Create a Product instance to access virtual fields
                const productInstance = new Product(product);

                return {
                    ...product,
                    calculatedPriceOptions: productInstance.calculatedPriceOptions,
                    hasActiveSales: productInstance.hasActiveSales,
                    lowestPrice: productInstance.lowestPrice
                };
            } catch (error) {
                console.error(`⚠️ CRITICAL: Error processing product ${product._id}:`, error);
                // Return original product data on error to prevent financial loss
                return product;
            }
        });

        handleResponse(res, 200, 'Products retrieved successfully', {
            products: processedProducts,
            total,
            results: processedProducts.length,
            currentPage: features.page,
            totalPages: Math.ceil(total / features.limit)
        });

    } catch (error) {
        console.error('⚠️ CRITICAL: Error in getAllProducts:', error);
        handleError(res, 500, 'Error retrieving products');
    }
};

// @desc    Get recent 6 products
// @route   GET /api/products/recent
// @access  Public
export const getRecentProducts = async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 }).limit(6).lean();

        // Safely process products with calculated sale prices
        const processedProducts = products.map(product => {
            try {
                // Create a Product instance to access virtual fields
                const productInstance = new Product(product);

                return {
                    ...product,
                    calculatedPriceOptions: productInstance.calculatedPriceOptions,
                    hasActiveSales: productInstance.hasActiveSales,
                    lowestPrice: productInstance.lowestPrice
                };
            } catch (error) {
                console.error(`⚠️ CRITICAL: Error processing recent product ${product._id}:`, error);
                // Return original product data on error to prevent financial loss
                return product;
            }
        });

        handleResponse(res, 200, 'Recent products retrieved successfully', processedProducts);
    } catch (error) {
        console.error('⚠️ CRITICAL: Error in getRecentProducts:', error);
        handleError(res, 500, 'Error retrieving recent products');
    }
};

// @desc    Get products by categories
// @route   GET /api/products/categories/:categoryId
// @access  Public
export const getProductsByCategories = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { page = 1, limit = 12, sort = 'featured' } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        let query = Product.find({ categories: categoryId, stock: { $gt: 0 } });
        let countQuery = Product.countDocuments({ categories: categoryId, stock: { $gt: 0 } });

        // Apply sorting
        switch (sort) {
            case 'price-asc':
                query = query.sort({ 'priceOptions.price': 1 });
                break;
            case 'price-desc':
                query = query.sort({ 'priceOptions.price': -1 });
                break;
            case 'name-asc':
                query = query.sort({ name: 1 });
                break;
            case 'name-desc':
                query = query.sort({ name: -1 });
                break;
            case 'date-asc':
                query = query.sort({ createdAt: 1 });
                break;
            case 'date-desc':
                query = query.sort({ createdAt: -1 });
                break;
            default: // featured
                query = query.sort({ ratings: -1, numOfReviews: -1 });
        }

        const products = await query.skip(skip).limit(parseInt(limit)).lean();
        const total = await countQuery;

        // Safely process products with calculated sale prices
        const processedProducts = products.map(product => {
            try {
                // Create a Product instance to access virtual fields
                const productInstance = new Product(product);

                return {
                    ...product,
                    calculatedPriceOptions: productInstance.calculatedPriceOptions,
                    hasActiveSales: productInstance.hasActiveSales,
                    lowestPrice: productInstance.lowestPrice
                };
            } catch (error) {
                console.error(`⚠️ CRITICAL: Error processing category product ${product._id}:`, error);
                // Return original product data on error to prevent financial loss
                return product;
            }
        });

        handleResponse(res, 200, 'Products by category retrieved successfully', {
            products: processedProducts,
            total,
            results: processedProducts.length,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });

    } catch (error) {
        console.error('⚠️ CRITICAL: Error in getProductsByCategories:', error);
        handleError(res, 500, 'Error retrieving products by category');
    }
};

// @desc    Get products by multiple categories
// @route   GET /api/products/by-categories
// @access  Public
export const getProductsByMultipleCategories = async (req, res) => {
    try {
        const { categories } = req.query;
        if (!categories) {
            return handleError(res, 400, 'Categories parameter required');
        }

        // Parse categories - can be comma-separated string or array
        let categoryIds = categories;
        if (typeof categories === 'string') {
            categoryIds = categories.split(',').map(id => id.trim());
        }

        // Validate that all category IDs are valid ObjectIds
        const { ObjectId } = await import('mongodb');
        const validCategoryIds = categoryIds.filter(id => ObjectId.isValid(id));

        if (validCategoryIds.length === 0) {
            return handleError(res, 400, 'No valid category IDs provided');
        }

        const products = await Product.find({ 
            categories: { $in: validCategoryIds }, 
            stock: { $gt: 0 } 
        }).sort({ ratings: -1, numOfReviews: -1 }).lean();

        // Safely process products with calculated sale prices
        const processedProducts = products.map(product => {
            try {
                // Create a Product instance to access virtual fields
                const productInstance = new Product(product);

                return {
                    ...product,
                    calculatedPriceOptions: productInstance.calculatedPriceOptions,
                    hasActiveSales: productInstance.hasActiveSales,
                    lowestPrice: productInstance.lowestPrice
                };
            } catch (error) {
                console.error(`⚠️ CRITICAL: Error processing multi-category product ${product._id}:`, error);
                // Return original product data on error to prevent financial loss
                return product;
            }
        });

        handleResponse(res, 200, 'Products by categories retrieved successfully', processedProducts);

    } catch (error) {
        console.error('⚠️ CRITICAL: Error in getProductsByMultipleCategories:', error);
        handleError(res, 500, 'Error retrieving products by categories');
    }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
export const searchProducts = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return handleError(res, 400, 'Search query required');

        const products = await Product.find({
            $text: { $search: q },
            stock: { $gt: 0 }
        }, {
            score: { $meta: "textScore" }
        }).sort({ score: { $meta: "textScore" } }).lean();

        // Safely process search results with calculated sale prices
        const processedProducts = products.map(product => {
            try {
                // Create a Product instance to access virtual fields
                const productInstance = new Product(product);

                return {
                    ...product,
                    calculatedPriceOptions: productInstance.calculatedPriceOptions,
                    hasActiveSales: productInstance.hasActiveSales,
                    lowestPrice: productInstance.lowestPrice
                };
            } catch (error) {
                console.error(`⚠️ CRITICAL: Error processing search product ${product._id}:`, error);
                // Return original product data on error to prevent financial loss
                return product;
            }
        });

        handleResponse(res, 200, 'Search results', processedProducts);

    } catch (error) {
        console.error('⚠️ CRITICAL: Error in searchProducts:', error);
        handleError(res, 500, 'Error searching products');
    }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).lean();

        if (!product) {
            return handleError(res, 404, 'Product not found');
        }

        // Safely process product with calculated sale prices
        let processedProduct;
        try {
            // Create a Product instance to access virtual fields
            const productInstance = new Product(product);

            processedProduct = {
                ...product,
                calculatedPriceOptions: productInstance.calculatedPriceOptions,
                hasActiveSales: productInstance.hasActiveSales,
                lowestPrice: productInstance.lowestPrice
            };
        } catch (error) {
            console.error(`⚠️ CRITICAL: Error processing product ${product._id}:`, error);
            // Return original product data on error to prevent financial loss
            processedProduct = product;
        }

        handleResponse(res, 200, 'Product retrieved successfully', processedProduct);

    } catch (error) {
        console.error('⚠️ CRITICAL: Error in getProductById:', error);
        if (error.name === 'CastError') {
            handleError(res, 400, 'Invalid product ID');
        } else {
            handleError(res, 500, 'Error retrieving product');
        }
    }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Admin
export const createProduct = async (req, res) => {
    try {
        console.log("🔥 Raw Request Body:", req.body);
        console.log("🔥 Type of Request Body:", typeof req.body);

        let { name, description, categories, stock, priceOptions, sale } = req.body;

        // Validation
        if (!name || !description || !categories || !stock || !priceOptions) {
            return handleError(res, 400, "Missing required fields");
        }
        console.log("🔥 Raw received priceOptions:", priceOptions);
        console.log("🔥 Type of priceOptions:", typeof priceOptions);

        // ✅ If priceOptions is a string, try parsing it
        if (typeof priceOptions === "string") {
            try {
                priceOptions = JSON.parse(priceOptions);
            } catch (error) {
                console.error("🔥 JSON Parse Error:", error.message);
                return handleError(res, 400, "Invalid price options format (JSON parse failed)");
            }
        }

        console.log("🔥 Parsed priceOptions:", priceOptions);
        console.log("🔥 Is priceOptions an array?", Array.isArray(priceOptions));

        if (!Array.isArray(priceOptions) || priceOptions.length === 0) {
            return handleError(res, 400, "Invalid price options");
        }

        for (const option of priceOptions) {
            if (!['packet', 'weight-based'].includes(option.type)) {
                return handleError(res, 400, "Invalid price option type");
            }
            if (option.weight <= 0 || option.price < 0) {
                return handleError(res, 400, "Invalid weight or price values");
            }
        }

        // Image handling
        if (!req.files?.length) {
            return handleError(res, 400, "At least one image required");
        }

        const images = req.files.map(file => ({
            public_id: file.filename,
            url: file.path
        }));

        // Check for existing product
        const existingProduct = await Product.findOne({ name });
        if (existingProduct) {
            await cleanupImages(images);
            return handleError(res, 400, "Product name exists");
        }

        // Create product
        const product = await Product.create({
            name,
            slug: name.toLowerCase().replace(/ /g, "-"),
            description,
            categories: Array.isArray(categories) ? categories : categories.split(','),
            stock,
            priceOptions: priceOptions.map(option => ({
                type: option.type,
                weight: option.weight,
                price: option.price,
                salePrice: option.salePrice || null
            })),
            sale: sale || null,
            images
        });

        handleResponse(res, 201, "Product created", product);

    } catch (error) {
        if (req.files?.length) {
            await cleanupImages(req.files.map(f => ({ public_id: f.filename })));
        }
        handleError(res, 500, "Server error");
    }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Admin
export const updateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return handleError(res, 404, 'Product not found');

        if (req.files?.length) {

            const newImages = req.files.map(file => ({
                public_id: file.filename,  // Store filename as public_id
                url: file.path             // Use the Cloudinary URL
            }));


            product.images = [...product.images, ...newImages]; // Add to existing images
            await product.save(); // 🔥 Save the updated product

        }


        if (req.body.imagesToDelete) {
            const imagesToDelete = Array.isArray(req.body.imagesToDelete)
                ? req.body.imagesToDelete
                : JSON.parse(req.body.imagesToDelete);  // Convert string to array

            await handleImageDeletions(imagesToDelete, product);
        }

        // Process updates
        const updates = processUpdates(req.body);
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );

        handleResponse(res, 200, 'Product updated', updatedProduct);

    } catch (error) {
        if (req.files?.length) {
            await cleanupImages(req.files.map(f => ({ public_id: f.public_id })));
        }
        handleValidationError(error, res);
    }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Admin
export const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return handleError(res, 404, 'Product not found');

        await Promise.all(
            product.images.map(img => deleteFromCloudinary(img.public_id))
        );

        await product.deleteOne();
        handleResponse(res, 200, 'Product deleted');

    } catch (error) {
        error.name === 'CastError'
            ? handleError(res, 400, 'Invalid product ID')
            : handleError(res, 500, error.message);
    }
};

// Helper functions
const processUpdates = (body) => {
    const updates = Object.keys(body)
        .filter(key => !['imagesToDelete'].includes(key))
        .reduce((acc, key) => {
            acc[key] = body[key];
            return acc;
        }, {});

    if (updates.name) {
        updates.slug = updates.name.toLowerCase().replace(/ /g, '-');
    }

    if (updates.categories) {
        updates.categories = Array.isArray(updates.categories)
            ? updates.categories
            : updates.categories.split(',');
    }

    if (updates.priceOptions) {
        updates.priceOptions = Array.isArray(updates.priceOptions)
            ? updates.priceOptions
            : JSON.parse(updates.priceOptions);  // Convert string to array

        updates.priceOptions = updates.priceOptions.map(option => ({
            type: option.type,
            weight: option.weight,
            price: option.price,
            salePrice: option.salePrice || null
        }));
    }


    return updates;
};

const handleImageDeletions = async (imagesToDelete, product) => {
    if (!Array.isArray(imagesToDelete)) return; // Ensure it's an array

    await Promise.all(
        imagesToDelete.map(async publicId => {
            await deleteFromCloudinary(publicId); // Delete from Cloudinary
            product.images = product.images.filter(img => img.public_id !== publicId); // Remove from product.images
        })
    );

    await product.save(); // 🔥 Save the product after deletion
};

const cleanupImages = async (images) => {
    await Promise.all(
        images.map(img => deleteFromCloudinary(img.public_id))
    );
};

const handleValidationError = (error, res) => {
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return handleError(res, 400, messages.join(', '));
    }
    handleError(res, 500, error.message);
};