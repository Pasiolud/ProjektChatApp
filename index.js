import express from 'express';
import {engine} from 'express-handlebars'
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import session from 'express-session';
import sqlite3 from "sqlite3"
import { error } from 'node:console';
import { execSync } from 'node:child_process';
import fs from 'node:fs'
const app = express();
const server = createServer(app);
const io = new Server(server)
const users = {};
var usersOnlineSocket = new Map()

const dbPath = "./db/chat.db"
if (!fs.existsSync(dbPath)){
  try{
    execSync("node ./db/createDb",{stdio:'inherit'})
  }catch(error){
    console.error("Błąd przy utworzeniu bazy",error.message)
  }
}

const db = new sqlite3.Database('./db/chat.db',(err)=>{
  if(err){
    console.error("Błąd połączenia z bazą",err.message)
  } else{
    console.error('Połączono z bazą')
  }
})

const sessionMiddleware = session({
    secret:'haslo-tajne123',
    resave:false,
    saveUninitialized:false
  })
app.use(sessionMiddleware); // ustawienia sesji analogia do php session_start(), ale tu trzeba podac parametry wiekszosc z nich jest opcjonalna poza secret chyba tylko. Tu byla zmianka zamiast od razu w app.user(session({....})) to dalem do zmiennej a potem do use bo musze sesje podpiac do socket.io ktory bazowo nie widzi sesji tak od siebie i musze uzyc middlware, poniżej w sekcji socketow tam jest uzyty io.engine()

io.engine.use(sessionMiddleware)


app.use(express.urlencoded({extended: true}))
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir:'./views',
  helpers:{
    eq: (x,y) => {return x===y}
  }
}))
app.set('view engine','hbs');
app.use(express.static('public'));
app.use(express.json());



app.get('/', (req, res) => {
  if(req.session?.name){
    return res.redirect('/dashboard')
  }else{
    return res.redirect('/login')
  }
});


app.get('/index/:friendId',(req,res)=>{
  if(req.session?.name){
    const friendId = req.params.friendId
    const userId = req.session.userId
    console.log(userId)
    var biggerId = null
    var smallerId = null
    if(friendId > userId){
      biggerId = friendId
      smallerId = userId
    }else{
      biggerId = userId
      smallerId = friendId
    }

    const sqlGetMessageHistory = "SELECT content, sender, timestamp FROM messages JOIN conversations ON messages.conversation_id = conversations.id WHERE conversations.user1 = ? AND conversations.user2 = ?;"

    db.all(sqlGetMessageHistory,[smallerId,biggerId],(err,rows)=>{
      if(err){
        console.log("Wystapil blad w zapytaniu sqlGetMessageHistory")
        return res.status(500).send("Błąd bazy danych");
      }

      var messageHistory = rows
      messageHistory = messageHistory.map(x=>{
        return{
        ...x,
        formattedDate: new Date(x.timestamp *1000).toLocaleString("pl-PL") // *1000 bo w bazie mam timestamp w sekundach nie mili 
        }
      })
      const sqlGetFriendName = "SELECT name from users where users.id = ?";
      db.get(sqlGetFriendName,[friendId],(err,row)=>{
        if(err){
          console.log("blad w zapytaniu sqlGetFriend!")
        }
        const friendName = row.name
        console.log("Imie znajomego:"+friendName)
        return res.render('index',{userId,friendId,layout:'main',messageHistory: messageHistory,friendName:friendName})
      })
      
    })

  }else{
    return res.redirect('/')
  }
  
})

app.get('/dashboard',(req,res)=>{
  if(req.session?.userId){
    return res.render('dashboard',{name: req.session.name})
  }else{
    return res.redirect('login')
  }
})

app.get('/friends',(req,res)=>{
  if(req.session?.name){
    const sqlGetPendingFriends = 'SELECT users.id,name, "pending" AS status FROM users JOIN friends ON users.id = friends.user_id WHERE friends.friend_id = ? AND friends.status = "pending";'
    const sqlGetAcceptedFriends = 'SELECT users.id, users.name, "accepted" AS status FROM users JOIN friends ON (users.id = friends.user_id OR users.id = friends.friend_id) WHERE (friends.user_id = ? OR friends.friend_id = ?) AND friends.status = "accepted" AND users.id <> ?'

    db.all(sqlGetPendingFriends,[req.session.userId],(err,pending)=>{
      if(err){
        console.log(`Wystapil blad przy zapytaniu! sqlGetPendingFriends ${err.message}`)
      }
      db.all(sqlGetAcceptedFriends,[req.session.userId,req.session.userId,req.session.userId],(err,accepted)=>{
        if(err){
          console.log("Wystapil blad przy zapytaniu sqlGetAcceptedFriends")
        }
        return res.render('friends',{pendingFriends: pending, acceptedFriends: accepted})
      })      
    })
    
  }else{
    return res.redirect('/')
  }
})

app.post('/acceptFriend', (req,res)=>{
  const friendId = req.body.friendId
  console.log("acceptFriend")
  const sqlAcceptFriend = 'UPDATE friends SET status="accepted" WHERE friend_id = ? AND user_id = ?'
  db.run(sqlAcceptFriend,[req.session.userId, friendId], (err)=>{
    if(err){
      console.log("Wystąpił błąd z zapytaniu sqlAcceptFriend!")
      return
    }
    return res.json({success: true})
  })
})
app.post('/rejectFriend', (req,res)=>{
  const friendId = req.body.friendId
  console.log("rejectFriend")
  const sqlRejectFriend = 'DELETE FROM friends WHERE status="pending" AND friend_id = ? AND user_id = ?'
  db.run(sqlRejectFriend,[req.session.userId, friendId], (err)=>{
    if(err){
      console.log("Wystąpił błąd z zapytaniu sqlRejectFriend!")
      return
    }
    return res.json({success: true})
  })
})

app.get('/searchFriends',(req,res)=>{
  if(req.session?.name){
    return res.render('searchFriends')
  }else{
    return res.redirect('/')
  }
})
app.get('/searchFriendsQuery',(req,res)=>{
  console.log("searchFriendsQuery dziala")
  const userInput = req.query.query
  const sqlSearchUserName = "SELECT id,name FROM users WHERE name LIKE ? AND name <> ? AND id NOT IN (SELECT friend_id FROM friends WHERE friends.user_id = ? UNION SELECT user_id from friends WHERE friends.friend_id = ?)"
  db.all(sqlSearchUserName,[`%${userInput}%`,req.session.name,req.session.userId,req.session.userId],(err,rows)=>{
    if(err){
      return res.status(500).send("Wystąpił błąd podczas próby pobrania danych z bazy")
    }
    return res.json(rows)
  }
  )
})
app.post('/addToFriends',(req,res)=>{
  console.log("Backedn addToFriends");
  const friendName = req.body.friendName
  console.log(friendName)
  const sqlGetFriendId = 'SELECT id FROM users WHERE name = ?'
  var friendId = null
  // Dostanie sie do id znajomka
  db.get(sqlGetFriendId,[friendName],(err,row)=>{
    if(err){
      return res.status(500).send("Wystapil blad")
    }
    if(row){
      friendId = row.id
      console.log(friendId)
      const sqlAddToFriends = "INSERT INTO friends(user_id, friend_id, status) VALUES(?,?,?)";
      db.run(sqlAddToFriends,[req.session.userId,friendId,'pending'],(err)=>{
        if(err){
          console.log('Wystąpił błąd przy dodawaniu do znaj'+err.message)
          return redirect('/searchFriends')
        }

        return res.json({'success':true})
      })
    }
  })
})

app.get('/register',(req,res)=>{
  
    if(req.session.userId){
      return res.redirect('/dashboard')
    }
    if(req.query.error){
    return res.render('register',{layout:false,error:req.query.error})
    }else{
      return res.render('register',{layout: false});
    }
    
})
app.post('/register',(req,res)=>{
  //const userEmail = req.body.email; mozna tak ale zrobia ta destrukturyzacja dla praktyki

  const {email,password} = req.body
  const sqlCheckUserName = "SELECT name FROM users where name = ?;"
  db.get(sqlCheckUserName,[email],(err,row) => {
    if(err){
      return res.status(500).send("Błąd serwera" + err.message)
    }
    if(row){
      console.log("Uzytkownik o takiej nazwie już istnieje!")
      return res.redirect(`/register?error=Błąd! Użytkownik o takiej nazwie już istnieje!`)
    }else{
      const sqlAddUser = "INSERT INTO users(`name`,`password_hash`) VALUES(?,?);"
      db.run(sqlAddUser,[email,password],(err)=>{
        if(err){
          console.log("Wystąpił błąd przy dodawaniu użytwkonika")
          return res.redirect('/register')
        }
      })
      return res.redirect('/')
    }
  })
})
//app.use(express.static(path.join(__dirname,"public"))) //  pozwala na wejscie doslownie localhost:3000/login.html i on wyswietli mi tak plik

app.get('/login',(req,res)=>{
  if(req.session.userId){
    return res.redirect('/dashboard')
  }
  if(req.query.error){
    return res.render('login',{layout:false, error:req.query.error})
  }
  else{return res.render('login',{layout:false})}

})
app.post('/login', (req,res)=>{
  const {email,password} = req.body
  const sqlLogin = "SELECT id,name,password_hash FROM users WHERE name = ? AND password_hash = ?;"
  db.get(sqlLogin, [email,password], (err,row)=>{
    if(err){
      return res.redirect('/')
    }
    if(row){
      console.log("Taki uzytkownik istnieje")
      req.session.name = email
      req.session.userId = row.id 
      usersOnlineSocket.set(req.session.userId,)
      return res.redirect('/dashboard')
    }else{
      console.log("Nie ma takiego użytkownika!")
      return res.redirect('/login?error=Błędne dane logowania !')
    }
  })
})

app.get('/logout',(req,res)=>{
  req.session.destroy((err)=>{
    console.log("Po sesji logout")

    return res.redirect('/')
  })

})

///CZESC WEB SOCKETOW
io.on('connection', (socket) => {
  //io.engine.use(sessionMiddleware);
  const session = socket.request.session;

  // stara wersja testowa
  // socket.on('chat message',(msg) => {
  //     const {to,text} = msg
  //     io.to().emit("chat message",text)
  // });

  socket.on('register',(msg)=>{
    const {userId} = msg
    usersOnlineSocket[userId] = socket.id
    console.log(`Dodano socket uzytkownika o id: ${userId} o numerze socketu: ${socket.id}`)
  })

  socket.on('chat message',(msg)=>{
    const {to,text} = msg
    console.log(session.userId)
    //Sprawdzenie czy jest taka konwersacja
    var smallerId, biggerId = null
    if(session.userId < to){
      smallerId = session.userId
      biggerId = to
    }else{
      smallerId = to
      biggerId = session.userId
    }
    // user1 to zawsze mniejsze id a user2 zawsze wieksze
    const sqlCreateConvOrIgnore = "INSERT OR IGNORE INTO conversations (user1,user2) VALUES (?,?)";
    db.run(sqlCreateConvOrIgnore,[smallerId,biggerId],(err)=>{
      if(err){
        console.log("Blad przy zapytaniu sqlCreateConvOrIgnore")
      }
      
      const sqlReturnConvId = "SELECT id FROM conversations WHERE user1 = ? AND user2 = ?;"
      db.get(sqlReturnConvId,[smallerId,biggerId],(err,row)=>{
        if(err){
          console.log("Blad przy zapytaniu sqlReturnConvId")
        }
        const convId = row.id
        const sqlAddMessageToHistory = "INSERT INTO messages (sender,content,timestamp,conversation_id) VALUES (?,?,?,?)"
        db.run(sqlAddMessageToHistory,[session.userId,text,Math.floor(Date.now()/1000),convId], (err)=>{
          if(err){
            console.log("Blad przy zapytaniu sqlAddMessageToHistory")
          }
          const currDate = new Date(Date.now()).toLocaleString('pl-PL')
          console.log(currDate)
          io.to(usersOnlineSocket[to]).emit('chat message', {text:text, date:currDate});
        })
        
      })
    })
  })

  socket.on('disconnect',() =>{
      console.log('dissconeted')
    });
});

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});
