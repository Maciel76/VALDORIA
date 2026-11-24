import {
  createIcons, House, Store, Landmark, Castle, BrickWall, Route, Flower2, TreePine, Flame, Flag,
  Coins, UsersRound, Hammer, Sun, CloudSun, Sunset, Moon, Map, Compass, PersonStanding, Settings2,
  RotateCcw, RotateCw, Plus, Minus, Crosshair, X, ChevronDown, ChevronRight, Move, Trash2,
  Expand, Globe2, CircleHelp, Save, Volume2, VolumeX, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  PanelLeft, MapPin, Pickaxe, LogOut, Radio, LockKeyhole, DoorOpen, DoorClosed, Layers, Search, Eye, ExternalLink
} from 'lucide';
const icons={House,Store,Landmark,Castle,BrickWall,Route,Flower2,TreePine,Flame,Flag,Coins,UsersRound,Hammer,Sun,
  CloudSun,Sunset,Moon,Map,Compass,PersonStanding,Settings2,RotateCcw,RotateCw,Plus,Minus,Crosshair,X,
  ChevronDown,ChevronRight,Move,Trash2,Expand,Globe2,CircleHelp,Save,Volume2,VolumeX,ArrowUp,
  ArrowDown,ArrowLeft,ArrowRight,PanelLeft,MapPin,Pickaxe,LogOut,Radio,LockKeyhole,DoorOpen,DoorClosed,Layers,Search,Eye,ExternalLink};
export const icon = name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
export function refreshIcons(){createIcons({icons,attrs:{'stroke-width':1.65}});}

