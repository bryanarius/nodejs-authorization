const express = require('express')
const router = express.Router();
const passport = require('passport')
const crypto = require('crypto')
const async = require('async')
const nodemailer = require('nodemailer')


const User = require('../models/usermodel');

// authentication check
function isAuthenticatedUser(req, res, next) {
    if(req.isAuthenticated()) {
        return next()
    }
    req.flash('error_msg', 'Please Login first to access this page.')
    res.redirect('/login')
}

//Get routes
router.get('/login', (req,res)=> {
    res.render('login')
});
router.get('/signup', (req,res)=> {
    res.render('signup')
})
router.get('/dashboard', isAuthenticatedUser,(req,res)=> {
    res.render('dashboard')
});

router.get('/forgot', (req, res)=>{
    res.render('forgot')
});

router.get('/logout', isAuthenticatedUser, (req, res)=> {
    req.logOut();
    req.flash('success_msg', 'You have been logged out.');
    res.redirect('/login')
})

router.get('/reset/:token', (req,res)=> {
    User.findOne({resetPasswordToken: req.params.token, resetPasswordExpires : {$gt : Date.now()}})
        .then(user =>{
            if(!user) {
                req.flash('error_msg', 'Password reset token is invalid or has expired');
                res.redirect('/forgot')
            }
            res.render('newpassword', {token : req.params.token});
        })
        .catch(err => {
            req.flash('error_msg', 'ERROR:' +err);
            res.redirect('/forgot')
        });
});

router.get('/passwordd/change', isAuthenticatedUser,(req, res)=> {
    res.render('changepassword');
})

//Post routes

router.post('/login', passport.authenticate('local', {
    successRedirect : '/dashboard',
    failureRedirect : '/login',
    failureFlash : 'Invalid email or password'
}));

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

router.post('/password/change', (req, res)=> {
    if(req.body.password !== req.body.confirmpassword) {
        req.flash('error_msg', "Password doesn't match. try again")
        return res.redirect('/password/change');
    }

    User.findOne({email : req.user.email})
        .then(user => {
            user.setPassword(req.body.password, err=>{
                user.save()
                    .then(user => {
                        req.flash('success_msg', 'Password changed successfully');
                        res.redirect('/dashboard');
                    })
                    .catch(err => {
                        req.flash('error_msg', 'ERROR:' +err)
                        res.redirect('/password/change');
                    });
            })
        })
})
// Routes to handle forgot password

router.post('/forgot' , (req, res, next)=> {
    let recoveryPassword = '';
    async.waterfall([
        (done) => {
            crypto.randomBytes(30, (err, buf)=> {
                let token = buf.toString('hex')
                done(err, token);
            });
        },

        (token, done) => {
            User.findOne({email : req.body.email})
                .then(user => {
                    if(!user) {
                        req.flash('error_msg', 'User does not exist with this email');
                        return res.redirect('/forgot');
                    }
                    user.resetPasswordToken = token;
                    user.resetPasswordExpires = Date.now() + 1800000; // Thirty Minutes

                    user.save(err => {
                        done(err, token, user);
                    });
                })
                .catch(err => {
                    req.flash('error_msg', 'ERROR: ' +err);
                    res.redirect('/forgot');
                })
        },
        (token, user) => {
            let smtpTransport = nodemailer.createTransport({
                service: 'Gmail',
                auth: {
                    user : process.env.GMAIL_EMAIL,
                    pass: process.env.GMAIL_PASSWORD
                }
            });

            let mailOptions = {
                to: user.email,
                from : 'Bryan Arius bryantest@gmail.com',
                subject : 'Recovery Email from Auth Project',
                text : 'Please click the following link to recover your password: \n\n' + 
                'http://' +req.headers.host + '/reset'+token+'\n\n'+
                'If you did not request this, please ignore this email.'
            };
            smtpTransport.sendMail(mailOptions, err=> {
                req.flash('success_msg', 'Email send with further instructions.')
                res.redirect('/forgot');
            });
        }
    ], err => {
         res.redirect('/forgot');
    });
});

router.post('/reset/:token', (req, res)=> {
    async.waterfall([
        (done) => {
            User.findOne({resetPasswordToken: req.params.token, resetPasswordExpires : {$gt : Date.now() } })
                .then(user => {
                    if(!user) {
                        req.flash('error_msg', 'Password reset token in invalid or has been expired.');
                        res.redirect('/forgot');
                    }

                    if(req.body.password !== req.body.confirmpassword) {
                        req.flash('error_msg', "Password don't match.");
                        return res.redirect('/forgot');
                    }

                    user.setPassword(req.body.password, err => {
                        user.resetPasswordToken = undefined;
                        user.resetPasswordExpires = undefined;

                        user.save(err => {
                            req.logIn(user, err => {
                                done(err, user);
                            })
                        });
                    });
                })
                .catch(err => {
                    req.flash('error_msg', 'ERROR: '+err);
                    res.redirect('/forgot');
                });
        },
        (user) => {
            let smtpTransport = nodemailer.createTransport({
                service : 'Gmail',
                auth: {
                    user : process.env.GMAIL_EMAIL,
                    pass : process.env.GMAIL_PASSWORD
                }
            });

            let mailOptions = {
                to : user.email,
                from : 'Bryan Arius bryanarius@gmail.com',
                subject : 'Your password has changed',
                text : 'Hello, ' +user.name+'\n\n'+
                'This is confirmation that the password for your account'+ user.email+'has been changed'
            };

            smtpTransport.sendMail(mailOptions, err=>{
                req.flash('success_msg', 'Your password has been changed successfully')
                res.redirect('/login');
            })
        }
    ], err => {
        res.redirect('/login');
    });
})
module.exports = router