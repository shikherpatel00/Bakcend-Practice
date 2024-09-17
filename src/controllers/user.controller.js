    import asyncHandler from "../utils/asyncHandler.js";
    import ApiError from "../utils/ApiError.js";
    import { User } from "../models/user.models.js";
    import uploadOnCloudinary from "../utils/cloudinary.js";
    import { ApiResponse } from "../utils/ApiResponse.js";
    import jwt from "jsonwebtoken";

    const generateAccessandRefreshTokens = async(userId) => {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new ApiError(404, "User not found");
            }
    
            const accessToken = user.generateAccessToken();
            const refreshToken = user.generateRefreshToken();
    
    
            user.refreshToken = refreshToken;
            await user.save({ validateBeforeSave: false });
    
            return { accessToken, refreshToken };
        } catch (error) {
            console.error("Error generating tokens: ", error);
            throw new ApiError(500, "Something went wrong while generating access and refresh tokens");
        }
    };
    

    const registerUser = asyncHandler(async (req,res)=>{
        const {fullName,email,username,password} = req.body;

        if(
            [fullName,email,username,password].some((field)=>field?.trim()==="")
        ){
            throw new ApiError(400,"All fields are required");
        }

        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if(existingUser)
            throw new ApiError(409, "User already exist");


        const avatarLocalPath = req.files?.avatar?.[0]?.path;
        // const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

        let coverImageLocalPath;
        if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0)
                coverImageLocalPath=req.files.coverImage[0].path;

        if(!avatarLocalPath)
            throw new ApiError(400, "Avatar is required");


        const avatar = await uploadOnCloudinary(avatarLocalPath);
        const coverImage = await uploadOnCloudinary(coverImageLocalPath);

        if(!avatar)
            throw new ApiError(400, "Avatar is required");

        const user = await User.create({
            fullName,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
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

    const loginUser = asyncHandler(async (req,res)=>{ 
        const {email,username,password} = req.body;

        if(!email && !username)
            throw new ApiError(400,"email or username is required");

        const user= await User.findOne({
            $or: [{username},{email}]
        });

        if(!user)   
            throw new ApiError(404, "User does not exist");

        const isPasswordValid = await user.isPasswordCorrect(password);

        if(!isPasswordValid)
            throw new ApiError(401, "Invalid Credentials");

        const {accessToken,refresToken} = await generateAccessandRefreshTokens(user._id);

        const loggedInUser = await User.findById(user._id).select(
            "-password -refreshToken"
        )

        const option = {
            httpOnly: true,
            secure: true
        }

        return res
        .status(200)
        .cookie("accessToken", accessToken, option)
        .cookie("refreshToken", refresToken, option)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refresToken
                },
                "User logged in successfully"
            )
        )
    })

    const logoutUser = asyncHandler(async (req,res)=>{
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $set:{
                    refreshToken: 1
                }
            },
            {
                new: true
            }
        )
        const options = {
            httpOnly: true,
            secure: true
        }

        return res
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken",options)
        .json(new ApiResponse(200,{},"User logged out successfully"));
    })

    const refreshAccessToken = asyncHandler(async (req,res)=>{
        const incomingRefeshToken = req.cookies.refresToken || req.body.refresToken;

        if(!incomingRefeshToken)   
            throw new ApiError(401, "Unauthorized reques");

        try {
            const decodedToken = jwt.verify(incomingRefeshToken,process.env.REFRESH_TOKEN_SECRET);
    
            const user = await user.findById(decodedToken._id);
    
            if(!user)   
                throw new ApiError(401,"Invlalid refresh token");
    
            if(incomingRefeshToken !== user?.refresToken)
                throw new ApiError(401, "Refresh Token is expired or used");
    
            const options = {
                httpOnly: true,
                secure: true
            }
    
            const {accessToken, newRefreshToken} = await generateAccessandRefreshTokens(user._id)
    
            return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(200,{accessToken,newRefreshToken},"Access Token Refreshed")
            )
        } catch (error) {
            throw new ApiError(401, error?.message || "Invalid refresh token");
        }
    })

    export { 
        registerUser, 
        loginUser ,
        logoutUser,
        refreshAccessToken
    };