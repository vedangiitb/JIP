const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const codeSessionSchema = new Schema({
    title:String,
    code: String,
    owner: String,
    interviewee: String,
    interviewers:[String]
})

module.exports = mongoose.model('Interview',codeSessionSchema);