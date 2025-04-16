const express = require('express');
const {Client,Pool} = require('pg');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer');
require('dotenv').config()

const app = express();
const port  = process.env.SRV_PORT
app.use(express.urlencoded({extended:true}));
const dbconfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
}
const pool = new Pool(dbconfig);
const saltRounds = process.env.SALT_ROUNDS*1;
const upload = multer()
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

app.use((req,res,next)=>{
    res.header('Access-Control-Allow-Origin','127.0.0.1')
    res.header('Access-Control-Allow-Methods','GET,POST')
    res.header('Access-Control-Allow-Headers','Content-Type')
    next()
})






async function criaBanco(){
    try{
        const client = new Client({
            user: dbconfig.user,
            host: dbconfig.host,
            password: dbconfig.password,
            port: dbconfig.port
        });
        await client.connect();
        const consulta = await client.query(`SELECT datname FROM pg_database WHERE datname = '${dbconfig.database}';`);
        if(consulta.rowCount == 0){
            console.log('Banco de dados não existe, criando...');
            await client.query(`CREATE DATABASE ${dbconfig.database};`);
            console.log('Banco de dados criado com sucesso!');
        }
        await client.end();
    }catch (error) {
        console.error('Erro ao criar o banco de dados:', error);
    }
}
async function criaTabela(){
    pool.query(`CREATE TABLE IF NOT EXISTS usuarios(
        id SERIAL,
        nome VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        senha VARCHAR(255) NOT NULL,
        ativo BOOLEAN DEFAULT FALSE,
        CONSTRAINT pk_usuarios PRIMARY KEY (id)
    );`);
}

async function gerarHash(senha) {
    const hash = await bcrypt.hash(senha, saltRounds);
    return hash;
}

async function EnviarEmail(dest,sub,msg) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: dest,
        subject: sub,
        text: msg,
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Erro ao enviar e-mail:', error);
        } else {
            console.log('E-mail enviado com sucesso:', info.response);
        }
    });
}

app.post('/login',async (req,res)=>{
    const {user,senha} = req.body;

    const consulta = await pool.query(`SELECT * FROM usuarios WHERE nome = $1 OR email = $1`, [user]);
    if(consulta.rowCount <=0){
        res.send('Usuário ou senha inválidos!');
    }else{
        const valid_passwd = await bcrypt.compare(senha, consulta.rows[0].senha);
        if(valid_passwd){
            res.sendFile(path.join(__dirname,"Loginok.html"));
        }else{
            res.send('Usuário ou senha inválidos!');
        }
    }
       
    
})

app.post('/cadastrar',upload.none(),async (req,res)=>{
    const {nome,email,senha} = req.body
    try{
        const payload = {email:email}
        const key = process.env.TOKEN_KEY
        const token_options = {expiresIn:'1h'}
        const token = jwt.sign(payload,key,token_options)

        await EnviarEmail(email,"Finalize o Seu cadastro","http://localhost:3000/token/"+token)
        const cripto = await gerarHash(senha);
        await pool.query(`INSERT INTO usuarios (nome,email,senha) VALUES ($1,$2,$3);`, [nome,email,cripto]);
        res.send("ok")
    }catch(error){
        console.log(error)
        res.send(error)
    }
})

app.get('/token/:code',async (req,res)=>{
    const key = process.env.TOKEN_KEY
    try{
        const decoded = jwt.verify(req.params.code,key)
        pool.query('UPDATE usuarios SET ativo = TRUE WHERE email = $1;',[decoded.email])
        console.log("Conta ativa")
        res.send('Conta ativada com sucesso!')
    }catch(err){
        console.log(err)
    }
})



app.listen(port, () => {
    console.log('Server is running on port '+port);
    criaBanco().then(() => {
        criaTabela()
    });
    
})