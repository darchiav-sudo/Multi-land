import React from "react";
import { useTranslation } from "@/hooks/use-translation";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Settings, Video, Cloud, Upload } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function AdminSettings() {
  const { t } = useTranslation();

  return (
    <AdminLayout>
      <div className="p-6">
        <AdminHeader
          title={t("Settings")}
          subtitle={t("Configure platform settings and run diagnostic tests")}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Testing Tools Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("Testing Tools")}</CardTitle>
              <CardDescription>
                {t("Tools for testing video player and cloud storage")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col space-y-2">
                <Link href="/admin/video-player-test">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full flex items-center justify-start"
                  >
                    <Video className="h-4 w-4 mr-2" />
                    {t("Video Player Testing")}
                  </Button>
                </Link>
                <p className="text-sm text-gray-500 pl-2">
                  {t("Test video player functionality, performance, and compatibility")}
                </p>
              </div>

              <Separator />

              <div className="flex flex-col space-y-2">
                <Link href="/admin/cloud-storage">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full flex items-center justify-start"
                  >
                    <Cloud className="h-4 w-4 mr-2" />
                    {t("Cloud Storage Management")}
                  </Button>
                </Link>
                <p className="text-sm text-gray-500 pl-2">
                  {t("Browse and manage files stored in the cloud")}
                </p>
              </div>

              <Separator />

              <div className="flex flex-col space-y-2">
                <Link href="/admin/s3-test">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full flex items-center justify-start"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {t("S3 Upload Testing")}
                  </Button>
                </Link>
                <p className="text-sm text-gray-500 pl-2">
                  {t("Test direct uploading to Amazon S3 storage")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Application Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("Application Settings")}</CardTitle>
              <CardDescription>
                {t("Configure global application behavior")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col space-y-2">
                <Link href="/admin/translations">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full flex items-center justify-start"
                  >
                    <svg 
                      className="h-4 w-4 mr-2" 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m5 8 6 6" />
                      <path d="m4 14 6-6 2-3" />
                      <path d="M2 5h12" />
                      <path d="M7 2h1" />
                      <path d="m22 22-5-10-5 10" />
                      <path d="M14 18h6" />
                    </svg>
                    {t("Translation Manager")}
                  </Button>
                </Link>
                <p className="text-sm text-gray-500 pl-2">
                  {t("Manage and edit translation keys across languages")}
                </p>
              </div>

              <Separator />

              <p className="text-gray-500 italic text-sm pt-4">
                {t("Additional settings will be available in future updates")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}