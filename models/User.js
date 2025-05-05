import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please enter your name'],
            trim: true
        },
        email: {
            type: String,
            unique: true,
            lowercase: true,
            sparse: true,
            index: {
                unique: true,
                partialFilterExpression: { email: { $type: 'string' } }
            },
            match: [/\S+@\S+\.\S+/, 'Please enter a valid email address']
        },
        phone: {
            type: String,
            unique: true,
            sparse: true,
            index: {
                unique: true,
                partialFilterExpression: { phone: { $type: 'string' } }
            },
            validate: {
                validator: function (v) {
                    return /^\+?[1-9]\d{1,14}$/.test(v);
                },
                message: props => `${props.value} is not a valid phone number!`
            }
        },
        password: {
            type: String,
            required: [true, 'Please enter a password'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user'
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        isBlocked: {
            type: Boolean,
            default: false
        },
        blockedAt: Date,
        suspendedUntil: Date,
        isDeleted: {
            type: Boolean,
            default: false
        },
        deletedAt: Date,
        emailVerificationToken: String,
        emailVerificationExpires: Date,
        phoneVerificationCode: String,
        phoneVerificationExpires: Date,
        resetToken: String,
        resetExpires: Date,
        refreshToken: String,
        addresses: [
            {
                street: String,
                city: String,
                postalCode: String,
                country: String,
                isDefault: {
                    type: Boolean,
                    default: false
                }
            }
        ],
        orders: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        }],
        hasRepliedOnWhatsApp: {
            type: Boolean,
            default: false
        },
        lastWhatsAppReply: {
            type: Date
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });

// Virtuals
userSchema.virtual('orderCount', {
    ref: 'Order',
    localField: '_id',
    foreignField: 'user',
    count: true
});

userSchema.virtual('totalSpent', {
    ref: 'Order',
    localField: '_id',
    foreignField: 'user',
    sum: 'totalAmount'
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ isBlocked: 1 });
userSchema.index({ isDeleted: 1 });

// Pre-save hooks
userSchema.pre('save', async function (next) {
    // Hash password if modified
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 12);
    }

    // Handle soft delete
    if (this.isModified('isDeleted') && this.isDeleted) {
        this.deletedAt = Date.now();
        // Anonymize data
        this.name = 'Deleted User';
        this.email = `deleted-${this._id}@example.com`;
        this.phone = null;
        this.addresses = [];
        this.refreshToken = undefined;
    }

    next();
});

userSchema.pre('save', async function (next) {
    // Ensure the isVerified status remains the same during update
    if (this.isModified('isVerified') && this.isNew === false) {
        // Do not change the isVerified status if it's being updated
        this.isVerified = this.isVerified;
    }

    // Handle soft delete
    if (this.isModified('isDeleted') && this.isDeleted) {
        this.deletedAt = Date.now();
        // Anonymize data
        this.name = 'Deleted User';
        this.email = `deleted-${this._id}@example.com`;
        this.phone = null;
        this.addresses = [];
        this.refreshToken = undefined;
    }

    next();
});


userSchema.pre('save', function (next) {
    // Prevent duplicate null values
    if (!this.email) this.email = undefined;
    if (!this.phone) this.phone = undefined;
    next();
});

// Validation
userSchema.pre('validate', function (next) {
    if (!this.email && !this.phone) {
        this.invalidate('email', 'Either email or phone must be provided');
        this.invalidate('phone', 'Either email or phone must be provided');
    }
    next();
});

// Query helpers
userSchema.query.excludeDeleted = function () {
    return this.where({ isDeleted: { $ne: true } });
};

// Instance methods
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.getPublicProfile = function () {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.refreshToken;
    delete userObject.emailVerificationToken;
    delete userObject.phoneVerificationCode;
    return userObject;
};

// Static methods
userSchema.statics.findByEmailOrPhone = async function (email, phone) {
    return this.findOne({
        $or: [
            { email: email?.toLowerCase() },
            { phone }
        ]
    });
};

userSchema.statics.getUserStats = async function () {
    return this.aggregate([
        {
            $facet: {
                totalUsers: [{ $count: 'count' }],
                activeUsers: [
                    { $match: { isBlocked: false, isDeleted: false } },
                    { $count: 'count' }
                ],
                admins: [
                    { $match: { role: 'admin' } },
                    { $count: 'count' }
                ]
            }
        }
    ]);
};

// Post-save hook for error handling
userSchema.post('save', function (error, doc, next) {
    if (error.name === 'MongoServerError' && error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        next(new Error(`${field} already exists`));
    } else {
        next(error);
    }
});

export default mongoose.model('User', userSchema);