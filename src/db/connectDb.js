import mongoose from "mongoose";
import { dbUser } from '../constants.js';

const connectDatabase = async function() {
    try {
        const response = await mongoose.connect(`${process.env.MONGODB_URI}/${dbUser}`)
        console.log(`Connected to database in host - ${response.connection.host}`);
    } catch (err) {
        console.log(`failed to connect to mongodb ${err}`);
    }
}

export { connectDatabase };

