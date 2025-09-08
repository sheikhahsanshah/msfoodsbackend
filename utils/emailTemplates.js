export const verificationEmail = (name, url) => `
  <div style="max-width: 600px; margin: 20px auto; padding: 20px; font-family: Arial, sans-serif;">
    <h2 style="color: #2d3748;">Hi ${name},</h2>
    <p>Please verify your email by clicking the button below:</p>
    <a href="${url}" style="display: inline-block; padding: 10px 20px; background: #4299e1; color: white; text-decoration: none; border-radius: 4px;">
      Verify Email
    </a>
    <p style="margin-top: 20px;">If you didn't create an account, you can safely ignore this email.</p>
  </div>
`;

export const passwordResetEmail = (name, url) => `
  <div style="max-width: 600px; margin: 20px auto; padding: 20px; font-family: Arial, sans-serif;">
    <h2 style="color: #2d3748;">Hi ${name},</h2>
    <p>You requested a password reset. Click the button below to reset your password:</p>
    <a href="${url}" style="display: inline-block; padding: 10px 20px; background: #48bb78; color: white; text-decoration: none; border-radius: 4px;">
      Reset Password
    </a>
    <p style="margin-top: 20px;">This link will expire in 10 minutes.</p>
  </div>
`;
export const generateOrderConfirmationEmail = (order) => {
    const orderNumber = order._id.toString().substr(-6);
    const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Helper to format numbers to two decimals
    const formatAmount = (amount) => Number(amount || 0).toFixed(2);

    // Calculate pricing for each item
    const items = (order.items || []).map(item => {
        const price = Math.round(item.priceOption?.price ?? 0);
        const originalPrice = Math.round(item.priceOption?.originalPrice ?? 0);
        const quantity = item.quantity ?? 0;
        const saleSavings = originalPrice > price ? quantity * (originalPrice - price) : 0;
        return {
            name: item.product?.name || item.name || 'Item',
            quantity,
            price,
            originalPrice,
            saleSavings
        };
    });

    // Calculate totals
    const originalSubtotal = items.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const saleSavings = items.reduce((sum, item) => sum + item.saleSavings, 0);

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Confirmation - MS Foods</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
                <h1 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">MS Foods</h1>
                
                <h2 style="color: #27ae60; margin-bottom: 20px;">Order Confirmation</h2>
                
                <p>Dear ${order.shippingAddress.fullName},</p>
                
                <p>Thank you for your order! We're excited to prepare your delicious food items.</p>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #2c3e50; margin-top: 0;">Order Details</h3>
                    <p><strong>Order Number:</strong> #${orderNumber}</p>
                    <p><strong>Order Date:</strong> ${orderDate}</p>
                    <p><strong>Total Amount:</strong> Rs. ${formatAmount(order.totalAmount)}</p>
                    <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                    <p><strong>Status:</strong> ${order.status}</p>
                </div>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #2c3e50; margin-top: 0;">Shipping Address</h3>
                    <p>${order.shippingAddress.fullName}</p>
                    <p>${order.shippingAddress.address}</p>
                    <p>${order.shippingAddress.city}${order.shippingAddress.postalCode ? `, ${order.shippingAddress.postalCode}` : ''}</p>
                    <p>${order.shippingAddress.country}</p>
                    <p>Phone: ${order.shippingAddress.phone}</p>
                </div>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #2c3e50; margin-top: 0;">Order Items</h3>
                    ${items.map(item => `
                        <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
                            <p><strong>${item.name}</strong></p>
                            <p>Quantity: ${item.quantity}</p>
                            <p>Price: Rs. ${formatAmount(item.price)}</p>
                            ${item.saleSavings > 0 ? `<p>Original Price: Rs. ${formatAmount(item.originalPrice)}</p>` : ''}
                            ${item.saleSavings > 0 ? `<p>Sale Savings: Rs. ${formatAmount(item.saleSavings)}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #2c3e50; margin-top: 0;">Order Summary</h3>
                    ${saleSavings > 0 ? `<p><strong>Original Subtotal:</strong> Rs. ${formatAmount(originalSubtotal)}</p>` : ''}
                    <p><strong>Subtotal:</strong> Rs. ${formatAmount(subtotal)}</p>
                    ${saleSavings > 0 ? `<p><strong>Sale Savings:</strong> -Rs. ${formatAmount(saleSavings)}</p>` : ''}
                    <p><strong>Shipping:</strong> ${order.shippingCost === 0 ? "Free" : `Rs. ${formatAmount(order.shippingCost)}`}</p>
                    ${order.discount > 0 ? `<p><strong>Discount:</strong> -Rs. ${formatAmount(order.discount)}</p>` : ''}
                    ${order.codFee > 0 ? `<p><strong>COD Fee:</strong> Rs. ${formatAmount(order.codFee)}</p>` : ''}
                    <p style="font-size: 18px; font-weight: bold; color: #27ae60; margin-top: 20px;"><strong>Total:</strong> Rs. ${formatAmount(order.totalAmount)}</p>
                </div>
                
                <p>We'll send you updates as your order progresses. You can track your order status in your account dashboard.</p>
                
                <p>If you have any questions, please don't hesitate to contact us at support@msfoods.pk</p>
                
                <p>Best regards,<br>The MS Foods Team</p>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #666; text-align: center;">
                    This email was sent to ${order.shippingAddress.email} because you placed an order with MS Foods.<br>
                    MS Foods | ${order.shippingAddress.address} | support@msfoods.pk
                </p>
            </div>
        </body>
        </html>
    `;
};

export const generateContactFormEmail = (contactData) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Contact Form Submission - MS Foods</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
                <h1 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">MS Foods</h1>
                
                <h2 style="color: #e74c3c; margin-bottom: 20px;">New Contact Form Submission</h2>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Name:</strong> ${contactData.name}</p>
                    <p><strong>Email:</strong> ${contactData.email}</p>
                    <p><strong>Phone:</strong> ${contactData.phone}</p>
                    <p><strong>Subject:</strong> ${contactData.subject}</p>
                    <p><strong>Message:</strong></p>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 10px;">
                        ${contactData.message.replace(/\n/g, '<br>')}
                    </div>
                </div>
                
                <p style="font-size: 12px; color: #666; text-align: center;">
                    This email was sent from the contact form on msfoods.pk<br>
                    MS Foods | support@msfoods.pk
                </p>
            </div>
        </body>
        </html>
    `;
};

export const generateMarketingEmail = (subject, content, images = []) => {
    // Handle images as objects with url and alt properties
    const imageHtml = images.length > 0 ?
        images.map(img => {
            const imgUrl = typeof img === 'string' ? img : img.url;
            const imgAlt = typeof img === 'string' ? 'MS Foods' : (img.alt || 'MS Foods');
            return `<img src="${imgUrl}" alt="${imgAlt}" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px;">`;
        }).join('') : '';

    // Process content to handle [IMAGE] placeholders
    let processedContent = content;
    if (images.length > 0 && content.includes('[IMAGE]')) {
        // Replace [IMAGE] placeholders with images
        processedContent = content.replace(/\[IMAGE\]/g, imageHtml);
    } else if (images.length > 0) {
        // If no [IMAGE] placeholder, append images at the end
        processedContent = content + imageHtml;
    }

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject} - MS Foods</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
                <h1 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">MS Foods</h1>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    ${processedContent}
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://msfoods.pk" style="background-color: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Visit Our Store</a>
                </div>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #666; text-align: center;">
                    You received this email because you're subscribed to MS Foods updates.<br>
                    <a href="https://msfoods.pk/unsubscribe" style="color: #666;">Unsubscribe</a> | 
                    <a href="https://msfoods.pk" style="color: #666;">Visit Website</a><br>
                    MS Foods | support@msfoods.pk
                </p>
            </div>
        </body>
        </html>
    `;
};