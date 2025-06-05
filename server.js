const express = require('express');
const {Client,Pool} = require('pg');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer');
require('dotenv').config()

const app = express();
const port  = process.env.PORT
const key = process.env.TOKEN_KEY


app.use(express.urlencoded({extended:true}));
app.use(express.json());

const pool = new Pool({
    /*user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT*/

    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
const saltRounds = 10;
const upload = multer()
/*const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});*/

app.use((req,res,next)=>{
    res.header('Access-Control-Allow-Origin','127.0.0.1')
    res.header('Access-Control-Allow-Methods','GET,POST')
    res.header('Access-Control-Allow-Headers','Content-Type')
    next()
})







async function criaTabela(){
    pool.query(`CREATE TABLE IF NOT EXISTS usuarios(
        id SERIAL,
        nome VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        senha VARCHAR(255) NOT NULL,
        telefone VARCHAR(15),
        data_matricula DATE DEFAULT CURRENT_DATE,
        CONSTRAINT pk_usuarios PRIMARY KEY (id)
    );`);
}

async function gerarHash(senha) {
    const hash = await bcrypt.hash(senha, saltRounds);
    return hash;
}

/*async function EnviarEmail(dest,sub,msg) {
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
}*/

app.post('/login',async (req,res)=>{
    const {user,senha} = req.body;

    const consulta = await pool.query(`SELECT * FROM usuarios WHERE nome = $1 OR email = $1`, [user]);
    if(consulta.rowCount <=0){
        return res.status(404).send('Usuário ou senha inválidos!');
    }else{
        const valid_passwd = await bcrypt.compare(senha, consulta.rows[0].senha);
        if(valid_passwd){
            return res.status(200).json({
                message: 'Login realizado com sucesso',
                token: jwt.sign({email:consulta.rows[0].email}, key, {expiresIn: '1h'})
            });
        }else{
            return res.status(401).json({message:'Usuário ou senha inválidos!'});
        }
    }
       
    
})



app.post('/cadastrar',verifyToken,async (req,res)=>{
    const {nome,email,senha,telefone} = req.body
    try{
        /*const payload = {email:email}
        
        const token_options = {expiresIn:'1h'}
        const token = jwt.sign(payload,key,token_options)*/

        //await EnviarEmail(email,"Finalize o Seu cadastro","http://localhost:3000/token/"+token)
        const cripto = await gerarHash(senha);
        await pool.query(`INSERT INTO usuarios (nome,email,senha,telefone) VALUES ($1,$2,$3,$4);`, [nome,email,cripto,telefone]);
        res.send("ok")
    }catch(error){
        console.log(error)
        res.send(error)
    }
})

async function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({message:'Token não fornecido'});
    }
    try {
        const decoded = jwt.verify(token, key);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token inválido:', error);
        return res.status(403).json({message:'Token inválido'});
    }
}

//Lista todos os usuários
app.get('/usuarios', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM usuarios');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).json({message:'Erro ao buscar usuários'});
    }
})

//Busca um usuário pelo ID e atualiza
app.put('/usuarios/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { nome, email, telefone } = req.body;
    try{
        const registro = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
        if (registro.rowCount === 0) {
            return res.status(404).json({message:'Usuário não encontrado'});
        }
        await pool.query(
            'UPDATE usuarios SET nome = $1, email = $2, telefone = $3 WHERE id = $4',
            [nome, email, telefone, id]
        );
    }catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        return res.status(500).json({message:'Erro ao atualizar usuário'});
    }
})

//Busca um usuário pelo ID e deleta
app.delete('/usuarios/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const registro = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
        if (registro.rowCount === 0) {
            return res.status(404).json({message:'Usuário não encontrado'});
        }
        await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
        res.status(200).json({message:'Usuário deletado com sucesso'});
    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        res.status(500).json({message:'Erro ao deletar usuário'});
    }
})



app.listen(port, () => {
    console.log('Server is running on port '+port);
    
    criaTabela()
    
})