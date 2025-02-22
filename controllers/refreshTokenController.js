const Users = require("../model/users");
const jwt = require("jsonwebtoken");

const handleRefreshToken = async (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(401);
    const refreshToken = cookies.jwt;
    res.clearCookie('jwt', { httpOnly: true, sameSite: "none", secure: true });

    const foundUser = await Users.findOne({ refreshToken }).exec();

    if (!foundUser) {
        jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET,
            async (err, decoded) => {
                if (err) return res.sendStatus(403);// forbidden
                const hackedUser = await Users.findOne({ username: decoded.username }).exec();
                hackedUser.refreshToken = [];
                const result = await hackedUser.save();
                console.log(result);
            })

        return res.sendStatus(403);// forbidden
    };
    const newRefreshTokenArray = foundUser.refreshToken.filter(rt => rt !== refreshToken);


    jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        async (err, decoded) => {
            if (err) {
                foundUser.refreshToken = [...newRefreshTokenArray];
                const result = await foundUser.save();
            }
            if (err || foundUser.username !== decoded.username) return res.sendStatus(403);
            // Refresh token was still vaild
            const roles = Object.values(foundUser.roles);
            const accessToken = jwt.sign(
                {
                    "UserInfo": {
                        "username": decoded.username,
                        "roles": roles
                    }
                },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: "1d" }
            );
            const newRefreshToken = jwt.sign(
                { "username": foundUser.username },
                process.env.REFRESH_TOKEN_SECRET,
                { expiresIn: "7d" }
            );

            foundUser.refreshToken = [...newRefreshTokenArray, newRefreshToken];
            await foundUser.save();
            
            res.cookie('jwt', newRefreshToken, { httpOnly: true, secure: true, sameSite: "none", maxAge: 24 * 60 * 60 * 1000 });//
            res.json({ roles, accessToken });
        }
    )
}
module.exports = { handleRefreshToken }