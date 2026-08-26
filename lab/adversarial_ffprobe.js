#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const assetsDir = path.resolve(__dirname, '../assets');
const videos = [
  { file: 'leg1.mp4', type: 'desktop', maxGOP: 8, expectedWidth: 1920, expectedHeight: 1080 },
  { file: 'leg2.mp4', type: 'desktop', maxGOP: 8, expectedWidth: 1920, expectedHeight: 1080 },
  { file: 'leg3.mp4', type: 'desktop', maxGOP: 8, expectedWidth: 1920, expectedHeight: 1080 },
  { file: 'leg4.mp4', type: 'desktop', maxGOP: 8, expectedWidth: 1920, expectedHeight: 1080 },
  { file: 'leg5.mp4', type: 'desktop', maxGOP: 8, expectedWidth: 1920, expectedHeight: 1080 },
  { file: 'leg6.mp4', type: 'desktop', maxGOP: 8, expectedWidth: 1920, expectedHeight: 1080 },
  { file: 'leg1-m.mp4', type: 'mobile', maxGOP: 4, expectedWidth: 720, expectedHeight: 1280 },
  { file: 'leg2-m.mp4', type: 'mobile', maxGOP: 4, expectedWidth: 720, expectedHeight: 1280 },
  { file: 'leg3-m.mp4', type: 'mobile', maxGOP: 4, expectedWidth: 720, expectedHeight: 1280 },
  { file: 'leg4-m.mp4', type: 'mobile', maxGOP: 4, expectedWidth: 720, expectedHeight: 1280 },
  { file: 'leg5-m.mp4', type: 'mobile', maxGOP: 4, expectedWidth: 720, expectedHeight: 1280 },
  { file: 'leg6-m.mp4', type: 'mobile', maxGOP: 4, expectedWidth: 720, expectedHeight: 1280 },
];

console.log('================================================================');
console.log('       FFPROBE VIDEO & GOP ADVERSARIAL INSPECTION');
console.log('================================================================\n');

const results = [];

for (const v of videos) {
  const filePath = path.join(assetsDir, v.file);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: File not found: ${v.file}`);
    results.push({ file: v.file, pass: false, error: 'File not found' });
    continue;
  }

  const stat = fs.statSync(filePath);
  const sizeKB = (stat.size / 1024).toFixed(1);

  // 1. Probe streams
  const probeStreamsCmd = `ffprobe -v quiet -print_format json -show_streams "${filePath}"`;
  const streamInfo = JSON.parse(execSync(probeStreamsCmd, { encoding: 'utf-8' }));
  
  const videoStreams = streamInfo.streams.filter(s => s.codec_type === 'video');
  const audioStreams = streamInfo.streams.filter(s => s.codec_type === 'audio');
  const totalStreams = streamInfo.streams.length;

  const vStream = videoStreams[0] || {};
  const width = vStream.width;
  const height = vStream.height;
  const codec = vStream.codec_name;
  const pixFmt = vStream.pix_fmt;
  const rFrameRate = vStream.r_frame_rate;
  const numFrames = parseInt(vStream.nb_frames || '0', 10);
  const duration = parseFloat(vStream.duration || '0');

  // 2. Probe frame keyframe types
  const probeFramesCmd = `ffprobe -v quiet -select_streams v -show_frames -show_entries frame=key_frame,pict_type,pkt_pts_time "${filePath}"`;
  const frameOutput = execSync(probeFramesCmd, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });
  
  const frames = [];
  const lines = frameOutput.split('\n');
  let curFrame = {};
  for (const line of lines) {
    if (line.includes('[FRAME]')) curFrame = {};
    else if (line.includes('[/FRAME]')) {
      frames.push(curFrame);
      curFrame = {};
    } else if (line.includes('=')) {
      const [k, val] = line.split('=');
      curFrame[k.trim()] = val.trim();
    }
  }

  // Calculate GOP intervals
  const keyframeIndices = [];
  frames.forEach((f, idx) => {
    if (f.key_frame === '1' || f.pict_type === 'I') {
      keyframeIndices.push(idx);
    }
  });

  const gopIntervals = [];
  for (let i = 1; i < keyframeIndices.length; i++) {
    gopIntervals.push(keyframeIndices[i] - keyframeIndices[i - 1]);
  }
  const maxObservedGOP = gopIntervals.length > 0 ? Math.max(...gopIntervals) : frames.length;
  const minObservedGOP = gopIntervals.length > 0 ? Math.min(...gopIntervals) : frames.length;
  const avgGOP = gopIntervals.length > 0 ? (gopIntervals.reduce((a, b) => a + b, 0) / gopIntervals.length).toFixed(2) : frames.length;

  // 3. Check faststart (moov atom location)
  // Read first 4KB of file and check if 'moov' atom appears before 'mdat'
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(8192);
  fs.readSync(fd, buffer, 0, 8192, 0);
  fs.closeSync(fd);
  const bufStr = buffer.toString('binary');
  const moovPos = bufStr.indexOf('moov');
  const mdatPos = bufStr.indexOf('mdat');
  const isFaststart = moovPos !== -1 && (mdatPos === -1 || moovPos < mdatPos);

  const audioCheck = audioStreams.length === 0;
  const gopCheck = maxObservedGOP <= v.maxGOP;
  const codecCheck = codec === 'h264';
  const faststartCheck = isFaststart;
  const pass = audioCheck && gopCheck && codecCheck && faststartCheck;

  const res = {
    file: v.file,
    type: v.type,
    sizeKB: `${sizeKB} KB`,
    width,
    height,
    codec,
    pixFmt,
    duration: `${duration.toFixed(2)}s`,
    totalFrames: frames.length,
    keyframeCount: keyframeIndices.length,
    maxGOPTarget: v.maxGOP,
    maxObservedGOP,
    minObservedGOP,
    avgGOP,
    gopIntervalsSample: gopIntervals.slice(0, 10),
    audioStreamsCount: audioStreams.length,
    isFaststart,
    pass,
    checks: {
      audioAbsent: audioCheck,
      gopCompliant: gopCheck,
      codecValid: codecCheck,
      faststartValid: faststartCheck
    }
  };

  results.push(res);

  console.log(`File: ${v.file} (${v.type.toUpperCase()})`);
  console.log(`  Dimensions: ${width}x${height} | Codec: ${codec} (${pixFmt}) | Duration: ${duration.toFixed(2)}s | Frames: ${frames.length}`);
  console.log(`  Audio Streams: ${audioStreams.length} (Expected: 0) -> ${audioCheck ? 'PASS' : 'FAIL'}`);
  console.log(`  GOP Target: <= ${v.maxGOP} | Max GOP: ${maxObservedGOP} | Min GOP: ${minObservedGOP} | Avg GOP: ${avgGOP} | Keyframes: ${keyframeIndices.length} -> ${gopCheck ? 'PASS' : 'FAIL'}`);
  console.log(`  Faststart (moov before mdat): ${isFaststart ? 'YES' : 'NO'} (moov offset: ${moovPos}, mdat: ${mdatPos}) -> ${faststartCheck ? 'PASS' : 'FAIL'}`);
  console.log(`  Overall Result: ${pass ? 'PASS' : 'FAIL'}\n`);
}

const allPassed = results.every(r => r.pass);
console.log('================================================================');
console.log(`OVERALL FFPROBE SUITE VERDICT: ${allPassed ? 'ALL PASS (100%)' : 'FAILURES DETECTED'}`);
console.log('================================================================');

fs.writeFileSync(path.resolve(__dirname, 'ffprobe_results.json'), JSON.stringify(results, null, 2));
