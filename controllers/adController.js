import Ad from "../models/Ad.js"

// Create new ad
export const createAd = async (req, res) => {
    try {
        const { title, text, startDate, endDate, location, isActive } = req.body

        // Validate required fields
        if (!title || !location) {
            return res.status(400).json({ error: "Title and location are required." })
        }

        // Validate files
        if (!req.files || !req.files.mobileImage || !req.files.desktopImage) {
            return res.status(400).json({ error: "Both mobileImage and desktopImage are required." })
        }

        const mobileImage = req.files?.mobileImage?.[0]
        const desktopImage = req.files?.desktopImage?.[0]

        if (!mobileImage || !desktopImage) {
            return res.status(400).json({ error: "Both mobileImage and desktopImage must be uploaded." })
        }

        // Prepare ad data
        const adData = {
            title,
            text,
            startDate: startDate || new Date(),
            endDate: endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 7 days from now
            location,
            mobileImage: mobileImage.path,
            desktopImage: desktopImage.path,
            isActive: isActive !== undefined ? isActive : true,
        }

        // Create ad in the database
        const ad = await Ad.create(adData)
        res.status(201).json(ad)
    } catch (err) {
        console.error("Ad creation error:", err)
        res.status(500).json({ error: "Failed to create ad. Please try again later." })
    }
}

export const updateAd = async (req, res) => {
    try {
        const { title, text, startDate, endDate, location, isActive } = req.body

        const updateData = {
            ...(title && { title }),
            ...(text !== undefined && { text }),
            ...(startDate && { startDate }),
            ...(endDate && { endDate }),
            ...(location && { location }),
            ...(isActive !== undefined && { isActive }),
        }

        if (req.files?.mobileImage?.[0]) {
            updateData.mobileImage = req.files.mobileImage[0].path
        }

        if (req.files?.desktopImage?.[0]) {
            updateData.desktopImage = req.files.desktopImage[0].path
        }

        const updatedAd = await Ad.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true,
        })

        if (!updatedAd) return res.status(404).json({ error: "Ad not found" })

        res.json(updatedAd)
    } catch (err) {
        res.status(400).json({ error: err.message })
    }
}

// Get ads for location
export const getAds = async (req, res) => {
    try {
        const now = new Date()

        const ads = await Ad.find({
            location: req.params.location,
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now },
        })

        res.json(ads)
    } catch (err) {
        res.status(400).json({ error: err.message })
    }
}

// Admin get all ads
export const getAllAds = async (req, res) => {
    try {
        const ads = await Ad.find().sort({ createdAt: -1 })
        res.json(ads)
    } catch (err) {
        res.status(400).json({ error: err.message })
    }
}

// Delete ad
export const deleteAd = async (req, res) => {
    try {
        await Ad.findByIdAndDelete(req.params.id)
        res.json({ message: "Ad deleted" })
    } catch (err) {
        res.status(400).json({ error: err.message })
    }
}
