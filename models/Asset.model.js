const mongoose = require("mongoose");

const assetSchema = new mongoose.Schema({
	type: String,
	filename: String,
	file_url: { type: String, required: true },
	user_name: String,
	desc: String,
	element_type: { type: String, required: true },
	title: String,
	user_id: String,
	is_private: Boolean,
	createdAt: { type: Date, default: Date.now },
});

const Asset = mongoose.model("asset", assetSchema);

module.exports = Asset;
