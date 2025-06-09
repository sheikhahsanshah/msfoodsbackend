// backend/utils/payfast.js
import fetch from 'node-fetch'
import crypto from 'crypto'

const {
    GOPAYFAST_BASE_URL,      // e.g. https://ipguat.apps.net.pk/Ecommerce/api/Transaction
    GOPAYFAST_MERCHANT_ID,
    GOPAYFAST_SECURED_KEY,
    GOPAYFAST_RETURN_URL,
    GOPAYFAST_CANCEL_URL,
    GOPAYFAST_NOTIFY_URL,
} = process.env

/**
 * 1) Fetch OAuth token from UAT’s GetAccessToken
 *    Must POST: MERCHANT_ID, SECURED_KEY, BASKET_ID, TXNAMT
 */
export async function fetchPayFastToken(basketId, txnAmt) {
    const url = `${GOPAYFAST_BASE_URL}/GetAccessToken`
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            MERCHANT_ID: GOPAYFAST_MERCHANT_ID,
            SECURED_KEY: GOPAYFAST_SECURED_KEY,
            BASKET_ID: basketId,
            TXNAMT: txnAmt,
        })
    })
    const json = await res.json()
    console.log('⏳ PayFast UAT token response:', json)

    const token = json.ACCESS_TOKEN
    if (!token) {
        throw new Error('PayFast UAT auth failed — no ACCESS_TOKEN in response')
    }
    return token
}

/** 2) Build SHA-256 signature for the order */
export function makePayFastSignature(basketId) {
    return crypto
        .createHash('sha256')
        .update(`${basketId}${GOPAYFAST_MERCHANT_ID}${GOPAYFAST_SECURED_KEY}`)
        .digest('hex')
}

/**
 * 3) Assemble the WebCheckout payload
 */
export async function generateGoPayFastPayload(order) {
    const basketId = order._id.toString()
    // MUST pass the same amount you’ll later post
    const txnAmt = order.totalAmount.toFixed(2)

    // fetch access token with basketId & amount
    const token = await fetchPayFastToken(basketId, txnAmt)
    const signature = makePayFastSignature(basketId)

    return {
        redirectUrl: `${GOPAYFAST_BASE_URL}/PostTransaction`,
        form: {
            MERCHANT_ID: GOPAYFAST_MERCHANT_ID,
            MERCHANT_NAME: 'MS Foods',
            TOKEN: token,
            PROCCODE: '00',
            TXNAMT: txnAmt,
            CURRENCY_CODE: 'PKR',
            CUSTOMER_MOBILE_NO: order.shippingAddress.phone,
            CUSTOMER_EMAIL_ADDRESS: order.shippingAddress.email,
            SIGNATURE: signature,
            VERSION: 'NODEJS-PAYFAST-1.0',
            TXNDESC: `Order #${basketId}`,
            SUCCESS_URL: GOPAYFAST_RETURN_URL,
            FAILURE_URL: GOPAYFAST_CANCEL_URL,
            BASKET_ID: basketId,
            ORDER_DATE: new Date().toISOString().slice(0, 19).replace('T', ' '),
            CHECKOUT_URL: GOPAYFAST_NOTIFY_URL,
        }
    }
}
