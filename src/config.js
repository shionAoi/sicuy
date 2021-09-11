const PORT = process.env.PORT;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME;
const REDIS_URL = process.env.REDIS_URL;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const POOLS = process.env.POOLS;
const JWT_LIFE_TIME = process.env.JWT_LIFE_TIME;
const JWT_PRIVATE = Buffer.from(process.env.JWT_PRIVATE, "base64").toString('utf8');
const JWT_PUBLIC = Buffer.from(process.env.JWT_PUBLIC, "base64").toString('utf8');
const JWT_ALGORITHM = process.env.JWT_ALGORITHM;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_REFRESH_ALGORITHM = process.env.JWT_REFRESH_ALGORITHM;
const JWT_REFRESH_TIME = process.env.JWT_REFRESH_TIME;
const STORAGE_PATH_PHOTOS = process.env.STORAGE_PATH_PHOTOS;
const STORAGE_PATH_DOCS = process.env.STORAGE_PATH_DOCS;

module.exports = {
    PORT,
    MONGODB_URI,
    MONGO_DB_NAME,
    POOLS,
    JWT_LIFE_TIME,
    REDIS_URL,
    REDIS_PASSWORD,
    JWT_ALGORITHM,
    JWT_PRIVATE,
    JWT_PUBLIC,
    STORAGE_PATH_PHOTOS,
    STORAGE_PATH_DOCS,
    JWT_REFRESH_ALGORITHM,
    JWT_REFRESH_TIME,
    JWT_REFRESH_SECRET
}