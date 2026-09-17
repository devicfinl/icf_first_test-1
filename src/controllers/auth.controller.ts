import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { checkOtp, generateOtp, saveOtp } from "../lib/otp.js";
import { isTokenRevoked, revokeToken } from "../lib/token-denylist.js";

const jwtSecret = process.env.JWT_SECRET ?? "";
if (!jwtSecret) {
  throw new Error("JWT_SECRET is not set");
}




export const memberLogin = async (req: Request, res: Response) => {
  try {
    const {
       userName,
      mobile,
      mobile_country: mobileCountry,
      password,
    } = req.body ?? {};
    
    console.log("userName:", userName, "mobile:", mobile, "mobileCountry:", mobileCountry, "password:", password);

    // --------------------------------
    // Validate username/mobile
    // --------------------------------
    if (!userName && !mobile) {
      return res.status(401).json({
        success: false,
        message: "Please enter either Username or Mobile Number.",
        data: null,
      });
    }

    if (typeof password !== "string" || password === "") {
      return res.status(401).json({
        success: false,
        message: "Please enter your password.",
        data: null,
      });
    }

    let user;

    // --------------------------------
    // LOGIN WITH USERNAME
    // --------------------------------
    if (userName) {
      user = await prisma.user.findFirst({
        where: {
          userName: String(userName),
        },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Wrong username.",
          data: null,
        });
      }
      console.log(user)
    }

    // --------------------------------
    // LOGIN WITH MOBILE
    // --------------------------------
    else {
      if (!mobileCountry || !mobile) {
        return res.status(401).json({
          success: false,
          message: "Mobile country code and mobile number are required.",
          data: null,
        });
      }

      // Remove spaces
      const cleanedMobile = String(mobile).replace(/\s/g, "");

      // Remove leading zeros
      const normalizedMobile = cleanedMobile.replace(/^0+/, "");

      // Find member
      const member = await prisma.membershipMaster.findFirst({
        where: {
          mobileCountry: String(mobileCountry),
          mobile: normalizedMobile,
        },
      });

      if (!member) {
        return res.status(401).json({
          success: false,
          message: "Wrong mobile number.",
          data: null,
        });
      }

      // Find user using membership number
      user = await prisma.user.findFirst({
        where: {
          userName: member.membershipNo,
        },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Not registered user.",
          data: null,
        });
      }
    }

    // --------------------------------
    // VERIFY PASSWORD
    // --------------------------------

    if (!user || !(await verifyPassword(user.password, password))) {
      return res.status(401).json({
        success: false,
        message: "Wrong Username or Password",
        data: null,
      });
    }

    // --------------------------------
    // CHECK USER STATUS (users.active: 1 = enabled)
    // --------------------------------

    if (user.active !== 1) {
      return res.status(401).json({
        success: false,
        message: "Your login is disabled",
        data: null,
      });
    }

    // --------------------------------
    // CREATE JWT
    // --------------------------------

    const token = jwt.sign(
      {
        sub: String(user.id),
        userName: user.userName,
        // Marks this as a session token; requireAuth refuses tokens issued for anything else.
        purpose: "access",
      },
      jwtSecret,
      {
        expiresIn: "15m",
        // Token id, so logout can revoke this exact token (see token-denylist).
        jwtid: randomUUID(),
      }
    );

    // --------------------------------
    // RESPONSE
    // --------------------------------

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        auth: {
          token,
          token_type: "Bearer",
        },
      },
    });
  } catch (error) {
    console.error("Member login error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      data: null,
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    // requireAuth verifies the token and sets req.auth before this runs.
    if (!req.auth) {
      return res.status(401).json({
        success: false,
        message: "Token not provided",
        data: null,
      });
    }

    revokeToken(req.auth.jti, req.auth.exp);

    return res.status(200).json({
      success: true,
      message: "Successfully logged out",
      data: null,
    });
  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to logout",
      data: null,
    });
  }
};

export const memberForgotPassword = async (req: Request, res: Response) => {
  try {
    const {
       membershipNo,
      mobile,
     mobileCountry,
    } = req.body ?? {};
console.log(req.body)
    // Prisma treats an undefined filter as "no filter" and would match a random row, so all
    // three fields are required before anything is looked up.
    if (!membershipNo || !mobile || !mobileCountry) {
      return res.status(401).json({
        success: false,
        message: "Membership number, mobile country code and mobile number are required.",
        data: null,
      });
    }

    const cleanedMobile = String(mobile).replace(/\s/g, "");
    const phoneNumber = `${String(mobileCountry).replace(/\s/g, "")}${cleanedMobile}`;

    // --------------------------------
    // CHECK USER EXISTS
    // --------------------------------
    const user = await prisma.user.findFirst({
      where: {
        userName: String(membershipNo),
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Member not found",
        data: null,
      });
    }

    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: "Generate password first",
        data: null,
      });
    }

    // --------------------------------
    // VERIFY MOBILE NUMBER
    // --------------------------------
    const member = await prisma.membershipMaster.findFirst({
      where: {
        membershipNo: String(membershipNo),
      },
    });

    if (!member) {
      return res.status(401).json({
        success: false,
        message: "Wrong membership number",
        data: null,
      });
    }

    const storedPhone = `${member.mobileCountry}${member.mobile}`.replace(/\s/g, "");

    if (storedPhone !== phoneNumber) {
      return res.status(401).json({
        success: false,
        message: "Wrong mobile number",
        data: null,
      });
    }

    // --------------------------------
    // GENERATE AND STORE OTP
    // --------------------------------
    const otp = generateOtp();
    saveOtp(member.mid, otp);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      data: {
        membership_no: membershipNo,
        mobile_country: mobileCountry,
        mobile: cleanedMobile,
        // TODO: send this by SMS instead, and remove it from the response before production.
        otp,
      },
    });
  } catch (error) {
    console.error("Member forgot password error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      data: null,
    });
  }
};

export const memberVerifyOtp = async (req: Request, res: Response) => {
  try {
    const { membershipNo, otp } = req.body ?? {};

    if (!membershipNo || !otp) {
      return res.status(401).json({
        success: false,
        message: "Membership number and OTP are required.",
        data: null,
      });
    }

    const member = await prisma.membershipMaster.findFirst({
      where: {
        membershipNo: String(membershipNo),
      },
    });

    if (!member) {
      return res.status(401).json({
        success: false,
        message: "Wrong membership number",
        data: null,
      });
    }

    const result = checkOtp(member.mid, String(otp).trim());

    if (result === "missing") {
      return res.status(401).json({
        success: false,
        message: "OTP expired. Please request a new one.",
        data: null,
      });
    }

    if (result === "too_many_attempts") {
      return res.status(401).json({
        success: false,
        message: "Too many wrong attempts. Please request a new OTP.",
        data: null,
      });
    }

    if (result === "wrong") {
      return res.status(401).json({
        success: false,
        message: "Wrong OTP",
        data: null,
      });
    }

    // Short-lived token for the password change step only; requireAuth rejects it elsewhere.
    const resetToken = jwt.sign(
      {
        sub: String(membershipNo),
        purpose: "password_reset",
      },
      jwtSecret,
      {
        expiresIn: "10m",
        jwtid: randomUUID(),
      }
    );

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      data: {
        reset_token: resetToken,
        token_type: "Bearer",
        expires_in: 600,
      },
    });
  } catch (error) {
    console.error("Member verify OTP error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      data: null,
    });
  }
};

export const memberResetPassword = async (req: Request, res: Response) => {
  try {
    const { resetToken, password, confirmPassword } = req.body ?? {};

    if (!resetToken || !password || !confirmPassword) {
      return res.status(401).json({
        success: false,
        message: "Reset token, password and confirm password are required.",
        data: null,
      });
    }

    if (typeof password !== "string" || typeof confirmPassword !== "string") {
      return res.status(401).json({
        success: false,
        message: "Password and confirm password must be text.",
        data: null,
      });
    }

    if (password !== confirmPassword) {
      return res.status(401).json({
        success: false,
        message: "Passwords do not match",
        data: null,
      });
    }

    if (password.length < 8) {
      return res.status(401).json({
        success: false,
        message: "Password must be at least 8 characters.",
        data: null,
      });
    }

    // --------------------------------
    // CHECK RESET TOKEN (from member-verify-otp)
    // --------------------------------
    let claims: JwtPayload;
    try {
      claims = jwt.verify(String(resetToken), jwtSecret) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          success: false,
          message: "Reset token expired. Please request a new OTP.",
          data: null,
        });
      }
      return res.status(401).json({
        success: false,
        message: "Invalid reset token",
        data: null,
      });
    }

    // A session token must not be usable here, and a reset token works only once.
    if (claims.purpose !== "password_reset" || !claims.jti || !claims.exp || isTokenRevoked(claims.jti)) {
      return res.status(401).json({
        success: false,
        message: "Invalid reset token",
        data: null,
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        userName: String(claims.sub),
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Member not found",
        data: null,
      });
    }

    // --------------------------------
    // SAVE NEW PASSWORD
    // --------------------------------
    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(password) },
    });

    revokeToken(claims.jti, claims.exp);

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
      data: null,
    });
  } catch (error) {
    console.error("Member reset password error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      data: null,
    });
  }
};
