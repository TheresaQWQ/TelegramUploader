const { StringSession } = require('telegram/sessions');
const gramJS = require('telegram');
const input = require('input')
const path = require('path');
const fs = require('fs');
const child_process = require('child_process')
const ProgressBar = require('progress')

const getArgv = (key, short) => {
  const argv = process.argv.slice(2);

  const index = argv.indexOf(`--${key}`);
  const s_index = argv.indexOf(`-${short}`);

  if (s_index !== -1) return argv[s_index + 1];
  if (index !== -1) return argv[index + 1];

  return null;
};

const getText = (id) => {
  const file = path.join('./texts', `${id}.txt`)

  if (!fs.existsSync(file)) return ''

  return fs.readFileSync(file).toString()
}

const login = async () => {
  const str = fs.existsSync('./telegram.session') ? fs.readFileSync('./telegram.session').toString() : ''
  const session = new StringSession(str);
  const telegram = new gramJS.TelegramClient(session, 8028813, '7d954adfdc85391d470cac2ecd3b7c30')

  await telegram.start({
    phoneNumber: async () => await input.text("Please enter your number: "),
    password: async () => await input.text("Please enter your password: "),
    phoneCode: async () => await input.text("Please enter the code you received: "),
    onError: (err) => console.log(err),
  });

  fs.writeFileSync('./telegram.session', telegram.session.save())

  return telegram
}

const readMetadata = file => {
  const random = Math.floor(Math.random() * 1000000)
  child_process.execSync(`ffprobe -v quiet -print_format json -show_format -show_streams "${file}" > ${random}.json`)
  const data = JSON.parse(fs.readFileSync(`${random}.json`).toString())
  
  fs.unlinkSync(`${random}.json`)
  return data
}

const upload = async (file, target, text) => {
  console.log(`loading...`)
  
  const telegram = await login()

  const me = await telegram.getMe()

  console.log(`login as ${`${me.firstName} ${me.lastName}`} (${me.username}, ${me.userId})`)

  console.log(`uploading...`)

  const info = readMetadata(file)

  const videoStream = info.streams.filter(stream => stream.codec_type === 'video')[0]
  const w = videoStream.width
  const h = videoStream.height
  const duration = Math.round(Number(videoStream.duration))
  const total = fs.statSync(file).size

  const bar = new ProgressBar(`Uploading [:bar] :rate/bps :percent :etas`, {
    total: total
  })

  let prev = 0

  await telegram.sendFile(target, {
    file: file,
    videoNote: true,
    caption: text,
    supportsStreaming: true,
    progressCallback: (progress) => {
      const curr = progress * total
      const diff = curr - prev
      prev = curr
      bar.tick(diff)
    },
    attributes: [new gramJS.Api.DocumentAttributeVideo({
      w: w,
      h: h,
      duration: duration,
      supportsStreaming: true,
    })]
  })
}

(async () => {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log([
      '使用方式:',
      '  node index.js',
      '可用参数:',
      '  --help, -h 查看帮助',
      '  --file, -f 文件路径',
      '  --chat, -c 对话id',
      '  --text, -i 文本id(文件路径: ./texts/xxx.txt)',
      '  --task, -t 指定任务列表文件',
    ].join('\n'));

    return
  }

  const file = getArgv('file', 'f');
  const target = getArgv('chat', 'c');
  const text = getText(getArgv('text', 'i'))
  const task = getArgv('task', 't')

  const fail = []

  if (task) {
    const tasks = require(task)

    for (const name of Object.keys(tasks)) {
      const conf = tasks[name]

      const target = conf.chat || target
      const template = conf.template || text

      for (const index in conf.tasks) {
        const task = conf.tasks[index]

        const text = template.replace(/\{\{(\d+)\}\}/g, (match, num) => {
          return task.args[num]
        })

        console.log(`start task: ${name}[${index}]`)

        try {
          await upload(task.file, target, text)
          console.log('\n')
        } catch (error) {
          console.log('\n')
          console.error(`上传失败:`, error)
          fail.push(`${name}[${index}, ${task.file}]: ${error.message}`)
        }

        console.log(`end task: ${name}[${index}]`)
      }
    }

    console.log(`done! ${fail.length} tasks failed:`)
    console.log(fail.join('\n'))
    process.exit(0)
  }

  if (!file) return console.log('No file provided');
  if (!target) return console.log('No target provided');

  upload(file, target, text)
})()
