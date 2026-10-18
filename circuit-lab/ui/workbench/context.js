// The workbench's state and actions, shared with the panels that render them.
import {createContext, useContext} from 'react';

export const WorkbenchContext = createContext(null);
export const useWorkbench = () => useContext(WorkbenchContext);
