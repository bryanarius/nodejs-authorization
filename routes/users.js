const express = require('express')
const router = express.Router();
const passport = require('passport')
const User = require('../models/usermodel');
//Get routes
router.get('/login', (req,res)=> {
    res.render('login')
})
router.get('/signup', (req,res)=> {
    res.render('signup')
})
router.get('/dashboard', (req,res)=> {
    res.render('dashboard')
})

//Post routes

router.post('/signup', (req, res)=> {
    let {name, email, password} = req.body;
    let userData = {
        name : name,
        email : email
    };

    User.register(userData, password, (err, user)=> {
        if(err) {
            req.flash('error_msg','ERROR:'+err)
            res.redirect('/signup')
        }
        passport.authenticate('local') (req, res, ()=> {
            req.flash('success_msg', 'Account Created');
            res.redirect('/login')
        });       
    }); 
});

module.exports = router