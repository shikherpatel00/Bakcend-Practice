const asyncHandler = (requestHandler) => {
    return (req,res,next)=>{
        Promise.resolve(requestHandler(req,res,next))
        .catch((err)=>next(err))
    }
}

export default asyncHandler

// The provided code defines an asyncHandler function that takes a requestHandler function as input and returns a new function. The new function is designed to handle asynchronous operations within Express.js route handlers.