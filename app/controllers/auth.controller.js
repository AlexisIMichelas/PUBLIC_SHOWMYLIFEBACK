const nodemailer = require("nodemailer");
const db = require("../models");
const config = require("../config/auth.config");
const User = db.user;
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Configuration de l'envoi d'e-mail via Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL, // Utilisez les variables d'environnement
    pass: process.env.PASSWORD,
  },
});

// Fonction pour demander la réinitialisation du mot de passe
const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "L'utilisateur n'existe pas" });
    }

    const secret = process.env.JWT + user.password;
    const token = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '1h' });

    const resetURL = `${process.env.CLIENT_URL}/resetpassword?id=${user.id}&token=${token}`;

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL,
      subject: 'Demande de réinitialisation de mot de passe',
      text: `Vous recevez ceci parce que vous (ou quelqu'un d'autre) avez demandé la réinitialisation du mot de passe de votre compte.\n\n
      Veuillez cliquer sur le lien suivant ou le coller dans votre navigateur pour terminer le processus :\n\n
      ${resetURL}\n\n
      Si vous n'avez pas demandé cela, veuillez ignorer cet e-mail et votre mot de passe restera inchangé.\n`,
    };

    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: 'Lien de réinitialisation du mot de passe envoyé' });

  } catch (error) {
    console.error('Erreur lors de la demande de réinitialisation :', error);
    return res.status(500).json({ message: 'Quelque chose s\'est mal passé' });
  }
};

const resetPassword = async (req, res) => {
  const { id, token, password } = req.body;

  try {
    const user = await User.findOne({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: "L'utilisateur n'existe pas !" });
    }

    const secret = process.env.JWT + user.password;
    try {
      jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({ message: 'Token invalide ou expiré.' });
    }

    const encryptedPassword = await bcrypt.hash(password, 10);
    await User.update({ password: encryptedPassword }, { where: { id } });

    return res.status(200).json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la réinitialisation du mot de passe.' });
  }
};



// Fonction pour changer l'email de l'utilisateur
const changeEmail = async (req, res) => {
  const userId = req.userId;
  const newEmail = req.body.email;

  try {
    await User.update({ email: newEmail }, { where: { id: userId } });
    return res.status(200).send({ message: "Email mis à jour avec succès!" });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

// Fonction pour changer le mot de passe
const changePassword = async (req, res) => {
  const userId = req.userId;
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send({ message: "Utilisateur non trouvé!" });
    }

    const passwordIsValid = bcrypt.compareSync(currentPassword, user.password);
    if (!passwordIsValid) {
      return res.status(401).send({ message: "Mot de passe actuel incorrect!" });
    }

    user.password = bcrypt.hashSync(newPassword, 8);
    await user.save();
    return res.status(200).send({ message: "Mot de passe changé avec succès!" });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

// Fonction d'inscription
const signup = async (req, res) => {
  try {
    const user = await User.create({
      username: req.body.username,
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password, 8),
    });
    return res.send({ message: "Utilisateur enregistré avec succès!" });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

// Fonction de connexion
const signin = async (req, res) => {
  try {
    const user = await User.findOne({ where: { username: req.body.username } });
    if (!user) {
      return res.status(404).send({ message: "Utilisateur non trouvé." });
    }

    const passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
    if (!passwordIsValid) {
      return res.status(401).send({ accessToken: null, message: "Mot de passe invalide!" });
    }

    const token = jwt.sign({ id: user.id }, config.secret, { expiresIn: 86400 }); // 24 heures
    return res.status(200).send({
      id: user.id,
      username: user.username,
      email: user.email,
      accessToken: token,
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

module.exports = {
  requestPasswordReset,
  resetPassword,
  changeEmail,
  changePassword,
  signup,
  signin,
};
