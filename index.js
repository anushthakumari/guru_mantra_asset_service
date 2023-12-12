const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();
const port = process.env.RESOURCES_PORT || 5000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});

// Define Asset schema
const assetSchema = new mongoose.Schema({
	type: String,
	filename: String,
	file_url: String,
	user_name: String,
	user_id: String,
	createdAt: { type: Date, default: Date.now },
});

const Asset = mongoose.model("asset", assetSchema);

// Set up Multer for file uploads
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const fileType = getFileType(file.mimetype);
		const uploadPath = path.join(__dirname, "uploads", fileType);

		// Create folder if it doesn't exist
		if (!fs.existsSync(uploadPath)) {
			fs.mkdirSync(uploadPath, { recursive: true });
		}

		cb(null, uploadPath);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const filename =
			file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname);
		cb(null, filename);
	},
});

const upload = multer({ storage: storage });

// Serve uploaded assets
app.use("/uploads", express.static("uploads"));

// API endpoint for uploading assets
app.post("/upload", upload.single("file"), async (req, res) => {
	try {
		const { user_id, user_name } = req.body;
		const { filename, path } = req.file;
		const fileType = getFileType(req.file.mimetype);

		const file_url = process.env.BASE_URL + `uploads/${fileType}/${filename}`;

		// Save asset information to MongoDB
		const newAsset = new Asset({
			type: fileType,
			filename,
			file_url,
			user_id,
			user_name,
		});
		await newAsset.save();

		res.json({ message: "Asset uploaded successfully", asset: newAsset });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

function getFileType(mimeType) {
	if (mimeType.startsWith("image/")) {
		return "images";
	} else if (mimeType.startsWith("audio/")) {
		return "audio";
	} else if (mimeType.startsWith("video/")) {
		return "videos";
	} else if (mimeType.startsWith("application/pdf")) {
		return "pdf";
	} else {
		return "others";
	}
}

app.listen(port, () => {
	console.log(`Server is running at http://localhost:${port}`);
});
