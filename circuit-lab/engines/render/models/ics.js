import {dip} from '../geo.js';
import {gate, dipIC} from './kit.js';

export const icsModels = {
opamp(g){dip(g,8,0,0,0,'LM358');},
ne555(g){dip(g,8,0,0,0,'NE555P');},
hc595(g){dip(g,16,0,0,0,'74HC595N');},
hc00(g,c){gate('00')(g,c);},
hc02(g,c){gate('02')(g,c);},
hc04(g,c){gate('04')(g,c);},
hc08(g,c){gate('08')(g,c);},
hc32(g,c){gate('32')(g,c);},
hc86(g,c){gate('86')(g,c);},
hc14(g,c){gate('14')(g,c);},
cd4017(g){dipIC(g,16,19.3,[['CD4017BE',1.6,-.75],['TI  21K4',1,1.4,.5]]);},
l293d(g){dipIC(g,16,19.3,[['L293D',1.6,-.75],['ST  GK 2214',1,1.4,.55]]);},
uln2003(g){dipIC(g,16,19.3,[['ULN2003A',1.6,-.75],['ST  2218',1,1.4,.5]]);},
lm393(g){dipIC(g,8,9.8,[['LM393N',1.35,-.65,.85],['TI 2205',.9,1.25,.6]]);}
};
