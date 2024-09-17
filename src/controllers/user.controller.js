import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req,res)=>{
    const {fullName,email,username,password} = req.body;
    console.log("e: ",email);

    if(
        [fullName,email,username,password].some((field)=>field?.trim()==="")
    ){
        throw new ApiError(400,"All fields are required");
    }

    const existingUser = User.findOne({
        $or: [{ username }, { email }]
    });

    if(existingUser)
        throw new ApiError(409, "User already exist");

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.file?.coverImage[0]?.path;

    if(!avatarLocalPath)
        throw new ApiError(400, "Avatar is required");

    const avatar = uploadOnCloudinary(avatarLocalPath);
    const conerImage = uploadOnCloudinary(coverImageLocalPath);

    if(!avatar)
        throw new ApiError(400, "Avatar is required");

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.ur || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    
    if(!createdUser)
        throw new ApiError(500, "Something went wrong while registering user");

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfuly")
    )
})

export default registerUser;