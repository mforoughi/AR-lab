import sharp from 'sharp';
import {applyCrop} from '../node_modules/@8thwall/image-target-cli/src/apply.js';
// Pad rather than crop the plan: preserve every wall and a reproducible origin.
await sharp('dist/assets/law-office-plan.png').extend({top:186,bottom:186,left:0,right:1,background:'#ffffff'}).toFile('dist/assets/tracking-plan.png');
await applyCrop(sharp('dist/assets/tracking-plan.png'),{type:'PLANAR',geometry:{left:0,top:0,width:774,height:1032,isRotated:false,originalWidth:774,originalHeight:1032}},'dist/image-targets','law-office',true);
