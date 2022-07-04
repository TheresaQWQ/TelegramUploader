const fs = require('fs');
const path = require('path');

if (!fs.existsSync('./input.txt')) {
  console.log('在 input.txt 文件中输入目标文件夹，一行一个')
  fs.writeFileSync('./input.txt', '')
  process.exit(1);
}

const target = fs.readFileSync('./input.txt').toString().split('\n').map(x => x.trim()).filter(x => x.length > 0)

const data = {}

for(const item of target) {
  const files = fs.readdirSync(item)

  data[item] = {
    "template": "",
    "chat": "@FFEE_CO",
    "tasks": files.map(file => {
      return {
        file: path.join(item, file),
        args: []
      }
    })
  }
}