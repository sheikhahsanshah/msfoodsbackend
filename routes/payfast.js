// backend/routes/payfast.js
import express from 'express'
import Order from '../models/Order.js'
import { fetchPayFastToken, generateGoPayFastPayload } from '../utils/payfast.js'

const router = express.Router()

/**
 * GET /api/payfast/banks
 * • Get a token (dummy basket & amount)  
 * • Call UAT’s ListBanks  
 * • Return array of { bank_code, name }
 */
router.get('/banks', async (req, res, next) => {
    try {
        // token endpoint now requires BASKET_ID & TXNAMT, use dummy values
        const dummyBasket = 'DUMMY'
        const dummyAmt = '0.00'
        const token = await fetchPayFastToken(dummyBasket, dummyAmt)

        const listRes = await fetch(
            `${process.env.GOPAYFAST_BASE_URL}/ListBanks`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        )
        const json = await listRes.json()
        res.json({ success: true, banks: json.banks || [] })
    } catch (err) {
        next(err)
    }
})

/**
 * GET /api/payfast/initiate/:orderId
 * • Find the order  
 * • Build the WebCheckout form & auto-submit
 */
router.get('/initiate/:orderId', async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.orderId)
        if (!order) return res.status(404).send('Order not found')

        const { redirectUrl, form } = await generateGoPayFastPayload(order)

        return res.send(`
      <!DOCTYPE html>
      <html>
        <body onload="document.forms[0].submit()">
          <form method="post" action="${redirectUrl}">
            ${Object.entries(form)
                .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}"/>`)
                .join('')}
          </form>
        </body>
      </html>
    `)
    } catch (err) {
        next(err)
    }
})

export default router
