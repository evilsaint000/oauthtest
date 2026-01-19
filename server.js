require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const path = require('path');

const app = express();


mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log(err));


const userSchema = new mongoose.Schema({
  googleId: String,
  displayName: String,
  email: String,
  image: String
});
const User = mongoose.model('User', userSchema);

//Passport Configuration
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    proxy: true
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      
      let existingUser = await User.findOne({ googleId: profile.id });
      
      if (existingUser) {
        return done(null, existingUser);
      }
      
     
      const newUser = await new User({
        googleId: profile.id,
        displayName: profile.displayName,
        email: profile.emails[0].value,
        image: profile.photos[0].value
      }).save();
      
      done(null, newUser);
    } catch (err) {
      done(err, null);
    }
  }
));

// Serialize/Deserialize User (for Session support)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch(err) {
    done(err, null);
  }
});

//  Middleware Setup
app.set('view engine', 'ejs'); // Use EJS for frontend templating
app.use(express.static('public')); // For CSS/Images
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Helper middleware to check if user is logged in
const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}



// Landing Page
app.get('/', (req, res) => {
  
  if (req.user) return res.redirect('/dashboard');
  res.render('index');
});

// Auth Route: Redirect to Google
app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

// Auth Callback: Google redirects back here
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication
    res.redirect('/dashboard');
  }
);

// Dashboard (Protected Route)
app.get('/dashboard', isLoggedIn, (req, res) => {
  res.render('dashboard', { user: req.user });
});

// Logout
app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

app.listen(process.env.PORT, () => {
  console.log(` Server running on http://localhost:${process.env.PORT}`);
});