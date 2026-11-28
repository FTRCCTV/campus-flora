import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/layout.js';
import '../dist/spots.js';
import '../dist/phenology.js';

const spots=globalThis.CampusSpots;
const phenology=globalThis.Phenology;

const record=(overrides={})=>({
  uid:'u-' + Math.random().toString(16).slice(2),
  latin:'Bellis perennis',name:'雏菊',form:'flower',date:'2026-11-28',
  location:'图书馆东侧',spot:'library',size:'small',zone:'sill',slot:0,
  photo:'data:image/jpeg;base64,AAAA',...overrides
});

test('campus spots are unique, inside the schematic and labelled',()=>{
  assert.equal(spots.points.length,10);
  assert.equal(new Set(spots.points.map(point=>point.id)).size,spots.points.length);
  for(const point of spots.points){
    assert.match(point.id,/^[a-z0-9-]+$/);
    assert.ok(point.x>=0&&point.x<=1&&point.y>=0&&point.y<=1);
    assert.ok(point.name.length>0);
  }
  assert.equal(spots.byId.get('library').name,'图书馆东侧');
});

test('summarize groups records by spot, counts species and picks the dominant form',()=>{
  const records=[
    record({spot:'library',latin:'Bellis perennis'}),
    record({spot:'library',latin:'Bellis perennis',form:'flower'}),
    record({spot:'library',latin:'Acer palmatum',form:'tree'}),
    record({spot:'lake',latin:'Mentha canadensis',form:'herb'}),
    record({spot:'',location:'旧操场',latin:'Rosa chinensis'})
  ];
  const rows=spots.summarize(records);
  const library=rows.find(row=>row.id==='library');
  assert.equal(library.count,3);
  assert.equal(library.speciesCount,2);
  assert.equal(spots.topForm(library.forms),'flower');
  assert.equal(rows.find(row=>row.id==='lake').count,1);
  const loose=rows.find(row=>row.id==='');
  assert.equal(loose.count,1);
  assert.equal(loose.name,'未标注地点');
  // Rows are ordered by count so the busiest spot is first.
  assert.equal(rows[0].id,'library');
});

test('placeLabel prefers the spot name over free text',()=>{
  assert.equal(spots.placeLabel(record()),'图书馆东侧');
  assert.equal(spots.placeLabel(record({spot:'',location:'旧操场'})),'旧操场');
  assert.equal(spots.placeLabel(record({spot:'',location:''})),'未标注地点');
  assert.equal(spots.speciesOf([record(),record({latin:'Acer palmatum'})]).length,2);
});

test('hitTest maps a click back to the nearest point',()=>{
  const canvas={width:800,height:600,getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})};
  const target=spots.byId.get('library');
  assert.equal(spots.hitTest(canvas,target.x*800,target.y*600),'library');
  assert.equal(spots.hitTest(canvas,5,595),'');
});

test('phenology month parsing survives ISO, slash, dotted and Chinese dates',()=>{
  assert.equal(phenology.monthOf({date:'2026-11-28'}),11);
  assert.equal(phenology.monthOf({date:'2026/4/5'}),4);
  assert.equal(phenology.monthOf({date:'2026.7.9'}),7);
  assert.equal(phenology.monthOf({date:'4月12日'}),4);
  assert.equal(phenology.monthOf({date:'2026/12/31'}),12);
  assert.equal(phenology.monthOf({date:'未知'}),0);
  assert.equal(phenology.monthOf(null),0);
});

test('phenology buckets observations per species and month',()=>{
  const records=[
    record({latin:'Bellis perennis',date:'2026-04-02'}),
    record({latin:'Bellis perennis',date:'2026-04-19'}),
    record({latin:'Bellis perennis',date:'2026-11-08'}),
    record({latin:'Acer palmatum',name:'鸡爪槭',form:'tree',date:'2026-11-20'}),
    record({latin:'',name:'未识别',date:'2026-11-21'})
  ];
  const rows=phenology.bySpecies(records);
  assert.equal(rows.length,2);
  const daisy=rows.find(row=>row.latin==='Bellis perennis');
  assert.equal(daisy.count,3);
  assert.deepEqual(daisy.months.map((value,index)=>value?index+1:0).filter(Boolean),[4,11]);
  assert.equal(daisy.months[3],2);
  assert.equal(daisy.active,true);
  const summary=phenology.summarize(records,{month:11});
  assert.equal(summary.species,2);
  assert.equal(summary.current,2);
  assert.equal(summary.records,5);
});
