const express = require("express");
const path = require('path');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const session = require('express-session');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user');
const CodeSession = require('./models/colabCode');
const flash = require('connect-flash');
mongoose.connect('mongodb://localhost:27017/JIP',{
})
const catchAsync = require('./utils/catchAsync');
const { Server } = require("socket.io");
const http = require('http');
const app = express();
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");



app.use(cors({ origin: 'http://localhost:3000' ,
    credentials: true,
}));


const server = http.createServer(app);


const io = new Server(server, {
    cors: {
      origin: "http://localhost:3000"
    }
  });

app.use(express.json());

const sessionConfig = {
    secret: 'thisshouldbeabettersecreat!',
    resave: 'false',
    saveUninitialized: true,
    cookie:{
        httpOnly:true,
        expires: Date.now() + 1000*60*60*24*7,
        maxAge: 1000*60*60*24*7
    }
}

io.on('connection', (socket) => {  
    // Extract session ID from the socket URL
    const sessionId = socket.handshake.query.sessionId;
  
    // Join the room (namespace) based on the session ID
    socket.join(sessionId);


    socket.on('updateCode', (newCode) => {
      // Emit the codeUpdate event only to clients in the same room (session)
      io.to(sessionId).emit('codeUpdate', newCode);
    });
  
    socket.on('disconnect', () => {
      console.log('A user disconnected');
      // Leave the room (namespace) when a user disconnects
      socket.leave(sessionId);
    });
  });

app.use(session(sessionConfig))
app.use(flash()); 

app.use(express.static(path.join(__dirname, 'public')));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()))
passport.serializeUser(User.serializeUser()) // Storing user in the session
passport.deserializeUser(User.deserializeUser()) // Un-Storing the user in the session

app.use((req,res,next)=>{
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

app.post('/register',catchAsync(async(req,res)=>{
    try{
    const {email,username,password} = req.body
    const user = new User({email, username})
    const registeredUser = await User.register(user,password);
    req.login(registeredUser,err =>{
        if (err) return next(err);
        console.log('success', 'Welcome to JIP');
        })
    } catch(e){
        console.log('error',e.message);
    }
}));

function sendEmail(interviewee,interviewers,id,name){
    let transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 587,
        secure: false,

        auth: {
          user: "vedangiitbombay@gmail.com",
          pass: "gxptgrpdiysrhpeq"
        }
      });
    for (let int of interviewers){
        let mailOptions = {
            from: "vedangiitbombay@gmail.com",
            to: int,
            subject: `Joining Id for your interview : ${name}`,
            html: `
            <h2>Hello interviewer!</h2>
            <p>The link for joining the interview is ${id}.<p>
            <p>Please make sure that you create an account on JIP before you start the interview<p>`
          };
        
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error("Error:", error);
            } else {
              console.log("Email sent:", info.response);
            }
          });
    }

    let mailOptions = {
        from: "Team JIP",
        to: interviewee,
        subject: `Joining Id for your interview : ${name}`,
        html: `
        <h2>Hello candidate!<h2>
        <p>The link for joining the interview is ${id}.</p>
        <p>Please create an account on JIP before you start the interview</p>
        `
      };
    
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error:", error);
        } else {
          console.log("Email sent:", info.response);
        }
      });

    console.log(interviewee)
    console.log(interviewers)
}

app.post('/create-code-session',catchAsync(async(req,res)=>{
    try{
        const {interviewee,interviewers} = req.body;
        
        const codeSession = new CodeSession(req.body);
        await codeSession.save()
        console.log(codeSession);
        res.send(codeSession._id.toString())
        sendEmail(interviewee,interviewers,codeSession._id.toString(),codeSession.title)
    }
    catch(e){
        console.log('error',e.message);
    }
}))


app.post('/get-interview-details',catchAsync(async(req,res)=>{
    try{
        const {id} = req.body;
        const interview = await CodeSession.findOne({_id:id})
        res.status(200).json({res:interview})
    }
    catch (error){
        console.log(error)
    }
}))

app.get('/get-code/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const code = await CodeSession.findOne({ _id: id });
  
      if (!code) {
        return res.status(404).send('Session not found');
      }
  
      res.json(code.code); // Send the code session as JSON response
    } catch (error) {
      console.error('Error retrieving code session:', error);
      res.status(500).send('Error retrieving code session');
    }
  });

  
app.post('/change-session-code',catchAsync(async(req,res)=>{
    try{
        const {id,code} = req.body;
        const updatedSession = await CodeSession.findByIdAndUpdate(id,{code:code});

        if (!updatedSession){
            console.log("Session not found!!!");
        }
        else{
            console.log("updated session")
            console.log(updatedSession);
        }
    }
    catch (e){
        console.log('error',e.message)
    }
}))

app.post('/login', passport.authenticate('local'), (req,res)=>{
    console.log('Logged in')
    res.status(200).json({ message: 'Login successful', user: req.user });
});

app.get('/protected', function(req, res) {
    // The user must be logged in to access this route.
    if (req.isAuthenticated()) {
      res.send('You are logged in.');
    } else {
      res.send('You are not logged in.');
    }
  });

app.get('/userinfo', (req, res) => {
    if (req.isAuthenticated()) {
      // User is logged in
      res.json({ isLoggedIn: true, user: req.user });
    } else {
      // User is not logged in
      res.json({ isLoggedIn: false });
    }
  });
  

app.get('/user-list',async(req,res) =>{
    const users = await User.find({})
    res.json({userlist:users});
})

app.get('/code-session-list',async(req,res)=>{
    const code_sessions = await CodeSession.find({})
    res.json({code_sessions:code_sessions})
})

app.get('/logout',(req,res,next) =>{
    req.logout(function (err) {
        if (err){
            return next(err);
        }
        req.flash('success',"Goodbye");
        res.send("Logged out!")
    });
});

app.post('/runcode',(req,res)=>{
    const {code,input,lang} = req.body;
    if (lang=="Python"){
        const scriptPath = `${__dirname}/temp_script.py`;
        const language = 'python3'
        fs.writeFileSync(scriptPath, code);
        const pythonProcess = spawn(language, [scriptPath]);
        if (input){
            pythonProcess.stdin.write(input);
            pythonProcess.stdin.end();
        }
    
        let output = '';
        let errorOutput = '';
    
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
    
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
    
        pythonProcess.on('close', (code) => {
            fs.unlinkSync(scriptPath);
    
            if (code !== 0) {
                res.status(200).json({ error: errorOutput });
                return;
            }
            console.log(output);
            res.status(200).json({ output });
        });
    }
    else if (lang=="Javascript"){
        const nodeProcess = spawn('node', ['-e', code]);
        if (input) {
            nodeProcess.stdin.write(input);
            nodeProcess.stdin.end();
        }
        
        let output = '';
        let errorOutput = '';
        
        nodeProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        nodeProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        nodeProcess.on('close', (code) => {
            if (code !== 0) {
                res.status(200).json({ error: errorOutput });
                return;
            }
            console.log(output);
            res.status(200).json({ output });
        });
        
    }    

});

server.listen(5000,()=>{
    console.log('Listening on port 5000')
})