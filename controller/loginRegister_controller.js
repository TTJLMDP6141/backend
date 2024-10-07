import pool from "../config/db.js";
import jwt from "jsonwebtoken";
import { sendEmail } from "./emailService.js";

const generateToken = (data) => {
  return jwt.sign(data, process.env.JWT_SECRET, { expiresIn: "1h" });
};

export const register = async (req, res) => {
  const { name, gmail, password, pro_email } = req.body;
  let role;

  try {
    const student = await pool.query(
      "SELECT * FROM student_login WHERE Email = ?",
      [gmail]
    );
    const teacher = await pool.query(
      "SELECT * FROM teacher_login WHERE Username = ?",
      [gmail]
    );
    if (student[0].length > 0) {
      role = 2;
      await pool.query(
        "INSERT INTO register (Name, Username, Password, Role, Professional_Email) VALUES(?,?,?,?,?)",
        [name, pro_email, password, role, gmail]
      );
      res.status(200).send("Registration successful");
    } else if (teacher[0].length > 0) {
      role = 1;
      await pool.query(
        "INSERT INTO register (Name, Username, Password, Role,Professional_Email) VALUES(?,?,?,?,?)",
        [name, gmail, password, role, gmail]
      );
      res.status(200).send("Registration successful");
    } else {
      res.status(400).send("Invalid email");
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
};

export const verify = async (req, res) => {
  const { gmail, password } = req.body;
  let role;

  try {
    const teacher = await pool.query(
      "SELECT * FROM teacher_login WHERE Username = ? AND Password = ?",
      [gmail, password]
    );
    const student = await pool.query(
      "SELECT * FROM student_login WHERE Email = ? AND Password = ?",
      [gmail, password]
    );
    if (student[0].length > 0) {
      role = 2;
    } else if (teacher[0].length > 0) {
      role = 1;
    }
    if (student[0].length > 0 || teacher[0].length > 0) {
      res.status(200).send({
        success: true,
        message: "Email and Password verified",
        role: role,
      });
    } else {
      res.status(400).send({
        success: false,
        message: "Inavlid Credentials",
      });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
};

export const checkRegistration = async (req, res) => {
  const email = req.params.email;

  try {
    const results = await pool.query(
      "SELECT * FROM register WHERE Email = ? AND Password IS NOT NULL",
      [email]
    );
    if (results[0].length > 0) {
      res.status(200).json({ registered: true });
    } else {
      res.status(200).json({ registered: false });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
};

export const login = async (req, res) => {
  const { gmail, password } = req.body;
  try {
    const results = await pool.query(
      "SELECT * FROM register WHERE Username = ? AND Password = ?",
      [gmail, password]
    );

    if (results[0].length > 0) {
      const user = results[0][0];
      const accessToken = generateToken({
        id: user.id,
        email: user.Email,
        role: user.Role,
      });

      res.status(200).send({
        success: true,
        message: "Login Successful",
        data: {
          user,
          accessToken,
        },
      });
    } else {
      res.status(401).send({
        success: false,
        message: "Invalid credentials",
        data: "Invalid credentials",
      });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success: false,
      message: "Error in login",
      data: err.message,
    });
  }
};

export const getAllTeacher = async (req, res) => {
  try {
    const teacher = await pool.query(
      "SELECT Name, Username, Role, SpecialAccess_Teacher, SpecialAccess_Student FROM register WHERE Role = 1"
    );
    if (teacher[0].length > 0) {
      res.status(200).send({
        success: true,
        message: "Data Fetched Successfully",
        data: teacher[0],
      });
    } else {
      res.status(401).send({
        success: false,
        message: "No Data Found",
        data: "No Data Found",
      });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success: false,
      message: "Error in Fetching data",
      data: err.message,
    });
  }
};

export const getAllStudent = async (req, res) => {
  try {
    const student = await pool.query(
      "SELECT Name, Username, Role FROM register WHERE Role = 2"
    );
    if (student[0].length > 0) {
      res.status(200).send({
        success: true,
        message: "Data Fetched Successfully",
        data: student[0],
      });
    } else {
      res.status(401).send({
        success: false,
        message: "No Data Found",
        data: "No Data Found",
      });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success: false,
      message: "Error in Fetching data",
      data: err.message,
    });
  }
};

export const forgotPasswordController = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).send({ message: "Email is required" });
    }
    //check
    const [user] = await pool.query(
      "SELECT * FROM register WHERE Username = ? AND Password IS NOT NULL",
      [email]
    );
    if (!user.length) {
      res.status(404).send({ success: false, message: "User not found" });
      return;
    }

    //me
    const resetPasswordToken = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const resetPasswordLink = `${process.env.APP_URL}/reset-password/${resetPasswordToken}`;

    const mailOptions = {
      to: email,
      subject: "Password reset Link",
      html: `click <a href= ${resetPasswordLink} >here</a> to reset your password`,
    };

    await sendEmail(mailOptions);

    res.status(200).send({
      success: true,
      message: "Password reset link has been sent to your email address.",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Something went wrong",
      error,
    });
  }
};

//reset password controller
export const resetPasswordController = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res
        .status(400)
        .send({ message: "Email and New password is required" });
    }

    const [user] = await pool.query("SELECT * FROM register WHERE Username = ?", [
      email,
    ]);
    if (!user.length) {
      res.status(400).send({
        success: false,
        message: "User not found.",
      });
      return;
    }

    await pool.query('UPDATE register SET Password = ? WHERE Email = ?', [newPassword, email]);

    res.status(200).send({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error in resetting password",
      error,
    });
  }
};
