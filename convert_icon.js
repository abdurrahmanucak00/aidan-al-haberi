const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const pngToIco = require('png-to-ico')

async function run() {
  const inputJpg = 'C:\\Users\\Abdurrahman\\.gemini\\antigravity\\brain\\684f6d3f-b9f5-4098-aea6-d178e4595fea\\aidan_al_haberi_icon_1788351631775.jpg'

  
  const resourcesDir = path.join(__dirname, 'resources')
  const buildDir = path.join(__dirname, 'build')

  if (!fs.existsSync(resourcesDir)) fs.mkdirSync(resourcesDir, { recursive: true })
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true })

  const png512 = path.join(buildDir, 'icon-512.png')
  const png256 = path.join(buildDir, 'icon-256.png')
  const pngFinal = path.join(buildDir, 'icon.png')
  const resourcesPng = path.join(resourcesDir, 'icon.png')

  // Generate 512x512 and 256x256 PNGs
  await sharp(inputJpg).resize(512, 512).png().toFile(png512)
  await sharp(inputJpg).resize(256, 256).png().toFile(png256)
  await sharp(inputJpg).resize(512, 512).png().toFile(pngFinal)
  await sharp(inputJpg).resize(512, 512).png().toFile(resourcesPng)

  // Generate .ico
  const icoBuffer = await pngToIco.default ? await pngToIco.default(png256) : await pngToIco(png256)
  
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer)
  fs.writeFileSync(path.join(resourcesDir, 'icon.ico'), icoBuffer)

  console.log('Icons generated successfully in build/ and resources/!')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
