'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sun, Moon, Monitor, LayoutGrid, List } from "lucide-react";
import { updateViewMode } from "@/server/actions/settings";
import { cn } from "@/lib/utils";

interface SettingsClientProps {
    orgId: string;
    orgSlug: string;
    initialViewMode: string;
}

export function SettingsClient({ orgId, orgSlug, initialViewMode }: SettingsClientProps) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [viewMode, setViewMode] = useState(initialViewMode);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    async function handleViewModeChange(newMode: string) {
        setIsSaving(true);
        setViewMode(newMode);
        await updateViewMode(orgId, newMode);
        setIsSaving(false);
    }

    if (!mounted) return null;

    const themes = [
        { value: 'light', label: 'Claro', icon: Sun },
        { value: 'dark', label: 'Escuro', icon: Moon },
        { value: 'system', label: 'Sistema', icon: Monitor },
    ];

    return (
        <div className="space-y-6">
            {/* Theme Section */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader>
                    <CardTitle className="text-slate-900 dark:text-white">Aparência</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                        Personalize a aparência do seu CRM.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Tema</Label>
                        <div className="flex gap-2">
                            {themes.map(({ value, label, icon: Icon }) => (
                                <Button
                                    key={value}
                                    variant="outline"
                                    onClick={() => setTheme(value)}
                                    className={cn(
                                        "flex-1 gap-2",
                                        theme === value
                                            ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-500"
                                            : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <Separator className="bg-slate-200 dark:bg-slate-800" />

                    <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Vista Padrão</Label>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Escolha como você quer visualizar seus leads ao abrir o CRM.
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => handleViewModeChange('kanban')}
                                disabled={isSaving}
                                className={cn(
                                    "flex-1 gap-2",
                                    viewMode === 'kanban'
                                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-500"
                                        : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                )}
                            >
                                <LayoutGrid className="h-4 w-4" />
                                Kanban
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handleViewModeChange('list')}
                                disabled={isSaving}
                                className={cn(
                                    "flex-1 gap-2",
                                    viewMode === 'list'
                                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-500"
                                        : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                )}
                            >
                                <List className="h-4 w-4" />
                                Lista
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
