const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const Asset = require("./models/Asset.model");

dotenv.config();

connectDB();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());

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

// get assets
app.use("/assets", async (req, res, next) => {
	const { element_type } = req.query;

	const filter = {
		is_private: false,
		...(element_type ? { element_type } : {}),
	};

	const data = await Asset.find(filter);

	res.send(data);
});

// API endpoint for uploading assets
app.post("/upload", upload.single("file"), async (req, res) => {
	try {
		const { user_id, user_name, is_private, title, element_type, desc } =
			req.body;
		const { filename } = req.file;
		const fileType = getFileType(req.file.mimetype);

		const file_url = process.env.BASE_URL + `uploads/${fileType}/${filename}`;

		// Save asset information to MongoDB
		const newAsset = new Asset({
			type: fileType,
			filename,
			file_url,
			user_id,
			user_name,
			title,
			element_type,
			desc,
			is_private: is_private === "true",
		});
		await newAsset.save();

		res.json({ message: "Asset uploaded successfully", asset: newAsset });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

// Route for serving live video stream
app.get("/stream/:assetId", async (req, res) => {
	try {
		const asset = await Asset.findById(req.params.assetId);

		if (!asset) {
			return res.status(404).json({ error: "Asset not found" });
		}

		const videoPath = path.join(__dirname, asset.path);

		const stat = fs.statSync(videoPath);
		const fileSize = stat.size;
		const range = req.headers.range;

		if (range) {
			const parts = range.replace(/bytes=/, "").split("-");
			const start = parseInt(parts[0], 10);
			const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
			const chunksize = end - start + 1;
			const file = fs.createReadStream(videoPath, { start, end });
			const head = {
				"Content-Range": `bytes ${start}-${end}/${fileSize}`,
				"Accept-Ranges": "bytes",
				"Content-Length": chunksize,
				"Content-Type": "video/mp4",
			};

			res.writeHead(206, head);
			file.pipe(res);
		} else {
			const head = {
				"Content-Length": fileSize,
				"Content-Type": "video/mp4",
			};

			res.writeHead(200, head);
			fs.createReadStream(videoPath).pipe(res);
		}
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

//delete the assest
app.delete("/delete/:assetId", async (req, res) => {
	try {
		const asset = await Asset.findById(req.params.assetId);

		if (!asset) {
			return res.status(404).json({ error: "Asset not found" });
		}

		// Delete the asset file
		const videoPath = path.join(
			__dirname,
			"uploads",
			asset.type,
			asset.filename
		);
		fs.unlinkSync(videoPath);

		// Delete the asset record from MongoDB
		await asset.deleteOne();

		res.json({ message: "Asset deleted successfully" });
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

async function connectDB() {
	const mg = await mongoose.connect(process.env.MONGODB_URI, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	});

	const dbConnection = mg.connection;

	dbConnection.once("open", (_) => {
		console.log(`Database connected: ${url}`);
	});

	dbConnection.on("error", (err) => {
		console.error(`connection error: ${err}`);
	});
}
