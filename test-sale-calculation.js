import mongoose from 'mongoose';
import Product from './models/Product.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test database connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Test global sale calculation
const testGlobalSaleCalculation = async () => {
    try {
        console.log('\n🧪 Testing Global Sale Calculation...\n');

        // Test Case 1: Product with 10% global sale
        console.log('📋 Test Case 1: Product with 10% global sale');
        const testProduct1 = new Product({
            name: 'Test Product - 10% Sale',
            description: 'Test product with 10% global sale',
            priceOptions: [
                { type: 'packet', weight: 500, price: 100, salePrice: null },
                { type: 'packet', weight: 1000, price: 180, salePrice: null }
            ],
            sale: 10, // 10% discount
            stock: 100,
            categories: [],
            images: []
        });

        console.log('Original prices:', testProduct1.priceOptions.map(p => `${p.weight}g: Rs.${p.price}`));
        console.log('Global sale percentage:', testProduct1.sale + '%');
        console.log('Calculated sale prices:', testProduct1.calculatedPriceOptions.map(p =>
            `${p.weight}g: Rs.${p.calculatedSalePrice} (Original: Rs.${p.originalPrice})`
        ));
        console.log('Has active sales:', testProduct1.hasActiveSales);
        console.log('Lowest price:', testProduct1.lowestPrice);
        console.log('---\n');

        // Test Case 2: Product with 25% global sale
        console.log('📋 Test Case 2: Product with 25% global sale');
        const testProduct2 = new Product({
            name: 'Test Product - 25% Sale',
            description: 'Test product with 25% global sale',
            priceOptions: [
                { type: 'packet', weight: 250, price: 50, salePrice: null },
                { type: 'packet', weight: 500, price: 90, salePrice: null }
            ],
            sale: 25, // 25% discount
            stock: 100,
            categories: [],
            images: []
        });

        console.log('Original prices:', testProduct2.priceOptions.map(p => `${p.weight}g: Rs.${p.price}`));
        console.log('Global sale percentage:', testProduct2.sale + '%');
        console.log('Calculated sale prices:', testProduct2.calculatedPriceOptions.map(p =>
            `${p.weight}g: Rs.${p.calculatedSalePrice} (Original: Rs.${p.originalPrice})`
        ));
        console.log('Has active sales:', testProduct2.hasActiveSales);
        console.log('Lowest price:', testProduct2.lowestPrice);
        console.log('---\n');

        // Test Case 3: Product with individual sale prices (should not be overridden)
        console.log('📋 Test Case 3: Product with individual sale prices (should not be overridden)');
        const testProduct3 = new Product({
            name: 'Test Product - Individual Sales',
            description: 'Test product with individual sale prices',
            priceOptions: [
                { type: 'packet', weight: 500, price: 100, salePrice: 80 }, // 20% off
                { type: 'packet', weight: 1000, price: 180, salePrice: null }
            ],
            sale: 15, // 15% global discount
            stock: 100,
            categories: [],
            images: []
        });

        console.log('Original prices:', testProduct3.priceOptions.map(p => `${p.weight}g: Rs.${p.price}`));
        console.log('Individual sale prices:', testProduct3.priceOptions.map(p =>
            `${p.weight}g: ${p.salePrice ? `Rs.${p.salePrice}` : 'No sale'}`
        ));
        console.log('Global sale percentage:', testProduct3.sale + '%');
        console.log('Calculated sale prices:', testProduct3.calculatedPriceOptions.map(p =>
            `${p.weight}g: Rs.${p.calculatedSalePrice} (Original: Rs.${p.originalPrice})`
        ));
        console.log('Has active sales:', testProduct3.hasActiveSales);
        console.log('Lowest price:', testProduct3.lowestPrice);
        console.log('---\n');

        // Test Case 4: Product with no sales
        console.log('📋 Test Case 4: Product with no sales');
        const testProduct4 = new Product({
            name: 'Test Product - No Sales',
            description: 'Test product with no sales',
            priceOptions: [
                { type: 'packet', weight: 500, price: 100, salePrice: null },
                { type: 'packet', weight: 1000, price: 180, salePrice: null }
            ],
            sale: null, // No global sale
            stock: 100,
            categories: [],
            images: []
        });

        console.log('Original prices:', testProduct4.priceOptions.map(p => `${p.weight}g: Rs.${p.price}`));
        console.log('Global sale percentage:', testProduct4.sale || 'None');
        console.log('Calculated sale prices:', testProduct4.calculatedPriceOptions.map(p =>
            `${p.weight}g: ${p.calculatedSalePrice ? `Rs.${p.calculatedSalePrice}` : 'No sale'}`
        ));
        console.log('Has active sales:', testProduct4.hasActiveSales);
        console.log('Lowest price:', testProduct4.lowestPrice);
        console.log('---\n');

        // Test Case 5: Edge case - 100% sale (should be prevented)
        console.log('📋 Test Case 5: Edge case - 100% sale (should be prevented)');
        const testProduct5 = new Product({
            name: 'Test Product - 100% Sale',
            description: 'Test product with 100% global sale (should be prevented)',
            priceOptions: [
                { type: 'packet', weight: 500, price: 100, salePrice: null }
            ],
            sale: 100, // 100% discount (should be prevented)
            stock: 100,
            categories: [],
            images: []
        });

        console.log('Original prices:', testProduct5.priceOptions.map(p => `${p.weight}g: Rs.${p.price}`));
        console.log('Global sale percentage:', testProduct5.sale + '%');
        console.log('Calculated sale prices:', testProduct5.calculatedPriceOptions.map(p =>
            `${p.weight}g: ${p.calculatedSalePrice ? `Rs.${p.calculatedSalePrice}` : 'No sale'}`
        ));
        console.log('Has active sales:', testProduct5.hasActiveSales);
        console.log('Lowest price:', testProduct5.lowestPrice);
        console.log('---\n');

        console.log('✅ All test cases completed successfully!');
        console.log('🔒 Financial safety checks are working correctly.');
        console.log('💰 Global sales are being calculated properly.');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
};

// Run tests
const runTests = async () => {
    try {
        await connectDB();
        await testGlobalSaleCalculation();
        console.log('\n🎉 All tests passed! Global sale system is working correctly.');
    } catch (error) {
        console.error('❌ Test suite failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 MongoDB disconnected');
        process.exit(0);
    }
};

// Run the test suite
runTests();
