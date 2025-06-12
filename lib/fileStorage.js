import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

// ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true})
}

// intialize users file if it doesn't exist
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({}))
}

export function getUserFiles(userId) {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))
    return users[userId]?.files || []
}

export function saveUserFile(userId, fileData) {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))

    if (!users[userId]) {
        users[userId] =  { files: [] }
    }

    const fileRecord = {
        id: Date.now().toString(),
        name: fileData.name,
        uploadDate: new Date().toISOString(),
        transactions: fileData.transactions,
        analysis: fileData.analysis || null,
        totalAmount: fileData.totalAmount,
        transactionCount: fileData.transactionCount
    }

    users[userId].files.push(fileRecord)
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))

    return fileRecord
}

export function deleteUserFile(userId, fileId) {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))

    if (users[userId]) {
        users[userId].files = users[userId].files.filter(file => file.id !== fileId)
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
    }
}

export function updateFileAnalysis(userId, fileId, analysis) {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))

    if (users[userId]) {
        const file = users[userId].files.find(f => f.id === fileId)
        if (file) {
            file.analysis = analysis
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
        }
    }
}